import { StringDecoder } from "node:string_decoder";
import htmlTableToObject from "./parser";
import fs from 'node:fs'
export enum Especialidades {
  SISTEMAS = "5",
  ELECTRONICA = "9",
  CIVIL = "31",
  ELECTROMECANICA= "8",
  TELECOMUNICACIONES = "15",
  QUIMICA = "27"

}
export async function getHorariosCursado(especialidad:Especialidades): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("especialidad", especialidad );
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
export async function getAllHorariosCursados(){
  const horariosCursado = await Promise.all([
    ...Object.values(Especialidades).map((especialidad)=>{
      return getHorariosCursado(especialidad)
    })
  ])
 await Promise.all([
    ...horariosCursado.map((async (h,i) => {
      return fs.writeFile( `../../horarios/parsed-${Especialidades[i]}.json `, JSON.stringify(await htmlTableToObject(h),null,2), e=>console.log(e))
    }))
  ])
}
await getAllHorariosCursados();