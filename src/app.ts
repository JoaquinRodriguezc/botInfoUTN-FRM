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

const PORT = process.env.PORT ?? 3008;
const USE_OPEN_IA = process.env.USE_OPEN_IA === "true";
const mainFlow = addKeyword("").addAction(
  async (ctx, { state, gotoFlow, endFlow }): Promise<void> => {
    if (USE_OPEN_IA) {
      console.log("Using IA for convert user input to commands");
      console.log("User:", ctx.body);
      const userQuery: UserQueryType = await convertMsgToQuery(ctx.body);
      console.log("Converted query", userQuery);
      if (userQuery.error) {
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
    } else {
    }
  }
);
const horariosFlow = addKeyword(EVENTS.ACTION).addAction(
  async (_, { flowDynamic, state, endFlow }) => {
    const { materia, comision } = state.get("data");
    if (!materia || !comision) {
      return endFlow(
        "No se encontró información para la materia y comisión mandada"
      );
    }
    const res = await searchHorario(materia, comision);
    if (!res.data) {
      console.log("No data for comision and materia");
      return endFlow(
        "No se encontró información para la materia y comisión mandada"
      );
    }
    console.log(res.data);
    return await flowDynamic(prettyPrintForWhatsApp(res.data[0]));
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
        await flowDynamic(res);
      } else {
        const materia = ctx.body.split(" ").slice(1).join(" ");
        console.log(materia);
        const res = await getBySubject(materia);
        await flowDynamic(res);
      }
    } else {
      const { materia } = state.get("data");
      if (materia) {
        console.log("Buscand mesa para: ", materia);
        const res = await getBySubject(materia);
        console.log(res);
        await flowDynamic(res);
      } else {
        const res = await getAll();
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

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

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
