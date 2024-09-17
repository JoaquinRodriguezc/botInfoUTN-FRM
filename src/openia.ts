import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function userInputToCommand(userInput: string) {
  const assistant = await openai.beta.assistants.retrieve(
    process.env.OPENAI_ASSISTANT_ID
  );
  if (!assistant) {
    console.log("No assistant");
  }
  const thread = await openai.beta.threads.create();
  const message = await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: userInput,
  });
  let run = await openai.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: assistant.id,
  });
  if (run.status === "completed") {
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    for (const message of messages.data.reverse()) {
      if (message.role === "assistant") {
        const text = message.content[0] as any;
        const assistantResponse = text.text.value.split("---");
        if (assistantResponse.length !== 2) {
          return {
            error: true,
            comision: null,
            materia: null,
          };
        }
        console.log(`${message.role} > ${text.text.value}`);
        return {
          error: false,
          comision: assistantResponse[0],
          materia: assistantResponse[1],
        };
      }
    }
  } else {
    console.log(run);
  }
}
