import { join } from "path";
import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  utils,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { getAll, getBySubject, listUpcomingEvents } from "./mesas";
import { prettyPrintForWhatsApp, searchHorario } from "./horarios";

const PORT = process.env.PORT ?? 3008;

const horariosFlow = addKeyword("!horario").addAnswer(
  "Buscando horario...",
  null,
  async (ctx, { flowDynamic }) => {
    const args = ctx.body.split(" ");
    if (args.length >= 3) {
      const materia = args.slice(1, -1).join(" ");
      const res = await searchHorario(materia, args.pop());
      if (!res) {
        console.log("error", res);
        return;
      }
      await flowDynamic(prettyPrintForWhatsApp(res[0]));
    } else {
      console.log("ERROR");
    }
  }
);

const mesasFlow = addKeyword("!mesas").addAnswer(
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

const registerFlow = addKeyword<Provider, Database>(
  utils.setEvent("REGISTER_FLOW")
)
  .addAnswer(
    `What is your name?`,
    { capture: true },
    async (ctx, { state }) => {
      await state.update({ name: ctx.body });
    }
  )
  .addAnswer("What is your age?", { capture: true }, async (ctx, { state }) => {
    await state.update({ age: ctx.body });
  })
  .addAction(async (_, { flowDynamic, state }) => {
    await flowDynamic(
      `${state.get(
        "name"
      )}, thanks for your information!: Your age: ${state.get("age")}`
    );
  });

const fullSamplesFlow = addKeyword<Provider, Database>([
  "samples",
  utils.setEvent("SAMPLES"),
])
  .addAnswer(`💪 I'll send you a lot files...`)
  .addAnswer(`Send image from Local`, {
    media: join(process.cwd(), "assets", "sample.png"),
  })
  .addAnswer(`Send video from URL`, {
    media:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4",
  })
  .addAnswer(`Send audio from URL`, {
    media: "https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3",
  })
  .addAnswer(`Send file from URL`, {
    media:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  });

const main = async () => {
  const adapterFlow = createFlow([mesasFlow, horariosFlow]);

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
