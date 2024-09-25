import OpenAI from "openai";
import "dotenv/config";
import fs from "node:fs";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
let promptMessage = null;
const USING_ASSISTANT = process.env.USING_ASSISTANT === "true";
export async function convertMsgToQuery(
  userInput: string
): Promise<UserQueryType> {
  try {
    if (USING_ASSISTANT) {
      const assistant = await openai.beta.assistants.retrieve(
        process.env.OPENAI_ASSISTANT_ID
      );
      if (!assistant) {
        console.log("No assistant");
      }
      const thread = await openai.beta.threads.create();
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userInput,
      });
      let run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistant.id,
      });
      if (run.status !== "completed") {
        throw new Error("Status not completed");
      }
      const messages = await openai.beta.threads.messages.list(run.thread_id);
      for (const message of messages.data.reverse()) {
        if (message.role !== "assistant") {
          return;
        }
        const text = message.content[0] as any;
        console.log("OpenIA response:", text);
        const assistantResponse: UserQueryType = JSON.parse(text.text.value);
        if (!assistantResponse) {
          throw new Error("Response could not be parsed");
        }
        console.log(`${message.role} > ${text.text.value}`);
        return assistantResponse;
      }
    } else {
      if (!promptMessage) {
        promptMessage = fs.readFileSync("./prompt.json", "utf8");
      }
      const parsedPrompt = JSON.parse(promptMessage);
      parsedPrompt.push({
        role: "user",
        content: userInput,
      });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: parsedPrompt,
      });
      const text = completion.choices[0].message as unknown as string;
      const completionRes: UserQueryType = JSON.parse(text);
      if (!completionRes) {
        throw new Error("Response could not be parsed");
      }
      return completionRes;
    }
  } catch (e) {
    console.log(e);
    return {
      error: true,
      query: null,
      data: null,
    };
  }
}
export type UserQueryType = {
  error: boolean | string;
  query: "horario" | "mesas" | "menu";
  data: DataMesas | DataHorarios | null;
};
export type DataMesas = {
  materia: string | null;
};
export type DataHorarios = {
  materia: string;
  comsision: string;
};
