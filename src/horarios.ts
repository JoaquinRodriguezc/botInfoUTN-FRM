import { StringDecoder } from "node:string_decoder";
import htmlTableToObject, { HorarioCurso } from "./parser";
import fs from "node:fs";
export enum Especialidades {
  SISTEMAS = "5",
  ELECTRONICA = "9",
  CIVIL = "31",
  ELECTROMECANICA = "8",
  TELECOMUNICACIONES = "15",
  QUIMICA = "27",
}
export async function getHorariosCursado(
  especialidad: Especialidades
): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("especialidad", especialidad);
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
export async function getAllHorariosCursados() {
  const horariosCursado = await Promise.all([
    ...Object.values(Especialidades).map((especialidad) => {
      return getHorariosCursado(especialidad);
    }),
  ]);
  await Promise.all([
    ...horariosCursado.map(async (h, i) => {
      return fs.writeFile(
        `../../horarios/parsed-${i}.json `,
        JSON.stringify(await htmlTableToObject(h), null, 2),
        (e) => console.log(e)
      );
    }),
  ]);
}

export async function loadHorarios() {
  try {
    const filesName = fs.readdirSync("../../horarios");
    if (!filesName || filesName.length === 0) {
      return;
    }
    const files = await Promise.all([
      ...filesName.map(async (file) => {
        return fs.readFileSync(`../../horarios/${file}`).toString();
      }),
    ]);
    const horarios = files
      .map((h) => JSON.parse(h) as HorarioCurso[])
      .reduce((acc: HorarioCurso[], currentValue: HorarioCurso[]) => {
        acc = [...acc, ...currentValue];
        return acc;
      });

    return horarios;
  } catch (error) {
    console.log(error);
  }
}
export async function searchHorario(
  plan: string,
  materia: string,
  curso: string
) {
  const horarios = await loadHorarios();
  console.log(horarios);
  const found = horarios.filter((e) => {
    if (e.materia === materia && e.curso === curso) {
      return e;
    }
  });
  if (found.length === 0) {
    console.log("Horario no encontrado");
    return;
  }
  return found;
}
const f = await searchHorario(
  "2023",
  "Algoritmos y Estructuras de Datos",
  "1K01"
);
f.forEach((f) => console.log(f));
