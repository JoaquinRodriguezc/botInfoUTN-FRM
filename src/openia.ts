import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function convertMsgToQuery(
  userInput: string
): Promise<UserQueryType> {
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
        const assistantResponse: UserQueryType = JSON.parse(text.text.value);
        if (!assistantResponse) {
          return {
            error: true,
            query: null,
            data: null,
          };
        }

        console.log(`${message.role} > ${text.text.value}`);
        return assistantResponse;
      }
    }
  } else {
    console.log(run);
  }
}
export type UserQueryType = {
  error: boolean;
  query: "horarios" | "mesas" | "menu";
  data: DataMesas | DataHorarios | null;
};
export type DataMesas = {
  materia: string | null;
};
export type DataHorarios = {
  materia: string;
  comsision: string;
};
