import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  EVENTS,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { getAll, getBySubject } from "./mesas.js";
import { prettyPrintForWhatsApp, searchHorario } from "./horarios.js";
import { convertMsgToQuery, UserQueryType } from "./openia.js";
import debounce from "./utils.js";

const PORT = process.env.PORT ?? 3008;
const USE_OPEN_IA = process.env.USE_OPEN_IA === "true";
const mainFlow = addKeyword("").addAction(
  async (ctx, { state, gotoFlow, endFlow, flowDynamic }): Promise<void> => {
    if (
      ctx.body.includes("event_media") ||
      ctx.body.includes("_event_voice_note__") ||
      ctx.body.includes("_event_document__")
    ) {
      console.log("Mensaje contiene imagenes,foto o audio.Aborot");
      return endFlow(
        "Soy buen lector pero no puedo leer imagenes  o escuchar tu audio :("
      );
    }
    if (ctx.body.length > 200) {
      console.log("Mensaje muy largo.Aborto.");
      return endFlow("Tu mensaje es muy largo por favor, mandamelo resumido!");
    }
    if (ctx.body.length <= 4) {
      if (ctx.body.toLowerCase() === "hola") {
        return endFlow("Hola!");
      }
      console.log("Mensaje muy corto.Aborto.");
      return endFlow("Tu mensaje fue muy corto, por favor explayate más!");
    }
    const from = ctx.from;
    const onGoingResponse = state?.getMyState()?.from;
    console.log("Is on going response?", onGoingResponse);
    console.log("Usuario que habla:", from);
    if (onGoingResponse) {
      console.log("Usuario ya tiene respuesta en camino");
      return endFlow("");
    }
    await state.update({ from: true });
    const getFrom = state.getMyState();
    console.log("Usuario agregado a estado ", getFrom);
    flowDynamic("Tu mensaje está siendo atendido...");
    const debunced = debounce(async () => {
      if (USE_OPEN_IA) {
        console.log("Using IA for convert user input to commands");
        console.log("User:", ctx.body);
        try {
          const userQuery: UserQueryType = await convertMsgToQuery(ctx.body);
          console.log("Converted query", userQuery);
          if (userQuery.error) {
            state.update({ from: null });
            return endFlow(
              `Ha habido un error procesando tu mensaje. Probá intentando de vuelta`
            );
          }
          await state.update({ data: userQuery.data });
          if (userQuery.query === "horario") {
            return gotoFlow(horariosFlow);
          }
          if (userQuery.query === "menu") {
            return gotoFlow(menuFlow);
          }
          if (userQuery.query === "mesas") {
            return gotoFlow(mesasFlow);
          }
        } catch (e) {
          console.log(e);
        }
      } else {
      }
    }, 10000);
    debunced(ctx.body);
  }
);
const horariosFlow = addKeyword(EVENTS.ACTION).addAction(
  async (ctx, { state, flowDynamic, endFlow }) => {
    const { materia, comision } = state.get("data");
    if (!materia || !comision) {
      state.update({ from: null });
      console.log("Usuario agregado borrado de estado respuesta en curso");
      return endFlow(
        "No se encontró información para la materia y comisión mandada"
      );
    }
    const res = await searchHorario(materia, comision);
    if (!res.data) {
      state.update({ from: null });
      console.log("Usuario agregado borrado de estado respuesta en curso");
      console.log("No data for comision and materia");
      return endFlow(
        "No se encontró información para la materia y comisión mandada"
      );
    }
    console.log(res.data);
    state.update({ from: null });
    console.log("Usuario agregado borrado de estado respuesta en curso");
    return endFlow(prettyPrintForWhatsApp(res.data[0]));
  }
);
const message = `
👋 *Hola!* Estos son los comandos para buscar información:

📄 */horario [materia] [comisión]*  
📝 *Ejemplo:*  
/horario Análisis de Sistemas de Información 2K01

📄 */mesas* (trae todas las mesas)  
📄 */mesas [nombre materia]*  
📝 *Ejemplo:*  
/mesas Informática I

📄 Para apuntes : https://apuntesutnmza.com

🌐 *Fuentes*:  
Información sacada de http://encuesta.frm.utn.edu.ar/horariocurso/  
Calendario de la Manuel Salvio: https://www.lamanuelsavio.org/calendario/
`;
const menuFlow = addKeyword(EVENTS.ACTION).addAnswer(message);
const apuntesFlow = addKeyword("/apuntes").addAnswer(
  "Página web con apuntes de alumnos: https://apuntesutnmza.com"
);
const mesasFlow = addKeyword(EVENTS.ACTION).addAnswer(
  "Buscando mesa...",
  null,
  async (ctx, { state, flowDynamic }) => {
    if (!USE_OPEN_IA) {
      if (ctx.body.split(" ").length === 1) {
        const res = await getAll();
        state.update({ from: null });
        await flowDynamic(res);
      } else {
        const materia = ctx.body.split(" ").slice(1).join(" ");
        console.log(materia);
        const res = await getBySubject(materia);
        state.update({ from: null });
        await flowDynamic(res);
      }
    } else {
      const { materia } = state.get("data");
      if (materia && materia !== "null") {
        console.log("Buscando mesa para: ", materia);
        const res = await getBySubject(materia);
        console.log(res);
        state.update({ from: null });
        await flowDynamic(res);
      } else {
        console.log("Buscando todas las mesas: ");
        const res = await getAll();
        state.update({ from: null });
        await flowDynamic(res);
      }
    }
  }
);

const main = async () => {
  const adapterFlow = createFlow([
    mainFlow,
    mesasFlow,
    horariosFlow,
    menuFlow,
    apuntesFlow,
  ]);

  const adapterProvider = createProvider(Provider);
  const adapterDB = new Database();

  const { handleCtx, httpServer } = await createBot(
    {
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    },
    {
      queue: {
        timeout: 20000,
        concurrencyLimit: 50,
      },
    }
  );

  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      const { number, message, urlMedia } = req.body;
      await bot.sendMessage(number, message, { media: urlMedia ?? null });
      return res.end("sended");
    })
  );

  adapterProvider.server.post(
    "/v1/register",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("REGISTER_FLOW", { from: number, name });
      return res.end("trigger");
    })
  );

  adapterProvider.server.post(
    "/v1/samples",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("SAMPLES", { from: number, name });
      return res.end("trigger");
    })
  );

  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body;
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add") bot.blacklist.add(number);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    })
  );

  httpServer(+PORT);
};

main();
