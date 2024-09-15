import fs from "node:fs";
import { StringDecoder } from "node:string_decoder";
export async function getHorariosCursado(): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("especialidad", "9");
  try {
    const response = await fetch(
      "http://encuesta.frm.utn.edu.ar/horariocurso/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    /*
  El servidor responde con el encoding iso-8859-1 (latin1) entonces hay que desencodearlo porque sino por defecto 
  se usa el UTF8 y los acentos se ven mal
  */
    const decoder = new StringDecoder("latin1");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const textDecoded = decoder.write(buffer);
    return textDecoded;
  } catch (e) {
    console.log(e);
  }
}
