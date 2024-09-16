import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { getAll, getBySubject } from "./mesas";
import { prettyPrintForWhatsApp, searchHorario } from "./horarios.js";
import { userInputToCommand } from "./openia";

const PORT = process.env.PORT ?? 3008;
const USE_OPEN_IA = process.env.USE_OPEN_IA === "true";
const horariosFlow = addKeyword("").addAnswer(
  "Buscando horario...",
  null,
  async (ctx, { flowDynamic }) => {
    let res;
    if (USE_OPEN_IA) {
      const { materia, comision } = await userInputToCommand(ctx.body);
      res = await searchHorario(materia, comision);
    } else {
      const args = ctx.body.split(" ");
      if (args.length >= 3) {
        const materia = args.slice(2).join(" ");
        res = await searchHorario(materia, args[1]);
      } else {
        await flowDynamic(
          `
  📄 */horario [materia] [comisión]*  
  📝 *Ejemplo:*  
  /horario Análisis de Sistemas de Información 2K01
  `
        );
      }
    }
    if (!res?.data) {
      await flowDynamic(
        "No se encontró horario para la comisión y materia pedida"
      );
      return;
    }
    await flowDynamic(prettyPrintForWhatsApp(res.data[0]));
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
console.log(message);
const startFlow = addKeyword("/menu").addAnswer(message);
const apuntesFlow = addKeyword("/apuntes").addAnswer(
  "Página web con apuntes de alumnos: https://apuntesutnmza.com"
);
const mesasFlow = addKeyword("/mesas").addAnswer(
  "Buscando mesa...",
  null,
  async (ctx, { flowDynamic }) => {
    if (ctx.body.split(" ").length === 1) {
      const res = await getAll();
      await flowDynamic(res);
    } else {
      const materia = ctx.body.split(" ").slice(1).join(" ");
      console.log(materia);
      const res = await getBySubject(materia);
      await flowDynamic(res);
    }
  }
);

const main = async () => {
  const adapterFlow = createFlow([
    mesasFlow,
    horariosFlow,
    startFlow,
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
