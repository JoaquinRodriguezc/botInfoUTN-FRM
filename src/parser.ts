import fs from "node:fs";
import { getHorariosCursado } from "./horarios";
export type HorarioCurso = {
  dias?: Record<string, Horario[]>;
} & ParsedRow;
type Horario = {
  diaCursado: string;
  horaInicio: string;
  horaFin: string;
};
type ParsedRow = {
  año: string | undefined;
  dictado: string | undefined;
  materia: string | undefined;
  curso: string | undefined;
  plan: string;
  diaCursado: string;
  horaInicio: string;
  horaFin: string;
};
export default async function htmlTableToObject() {
  const text = await getHorariosCursado();
  // Obtenemos la tabla

  const table = text
    .split("</table>")
    .join("ASD")
    .split('<table align="center" width="700" id="horario" >')
    .join("ASD")
    .split("ASD")[1];

  // Limpiamos caracteres y palabras que no necesitamoss
  const cleanedTable = table
    .split(/<\/*center>/)
    .join("")
    .split(/class\s*=\s*'[^']*'/i)
    .join("")
    .split(/\s{2,}/g)
    .join(" ");

  fs.writeFileSync("./table.html", cleanedTable);
  const rows = cleanedTable
    .split(/<\s*\/*tr\s*>/)
    .map((e) => e.trimStart())
    .filter((e) => e !== "");
  // REMOVE TABLE HEADERS
  rows.shift();
  const horarios = rows.map((r) => parseHTMLRow(r));
  const finalResult: HorarioCurso[] = [];
  horarios.reduce(
    (acc: HorarioCurso, currentValue: HorarioCurso, currentIndex) => {
      const {
        horaFin,
        horaInicio,
        diaCursado,
        plan: p,
        ...other
      } = currentValue;
      const plan = `Plan-${p}`;
      if (currentValue.año !== "") {
        if (currentIndex !== 0) {
          finalResult.push(acc);
        }
        currentValue["dias"] = {};
        if (!currentValue.dias[plan]) {
          currentValue.dias[plan] = [];
        }
        currentValue.dias[plan].push({
          diaCursado,
          horaInicio,
          horaFin,
        });
        const dias = currentValue.dias;
        return { ...other, dias };
      } else {
        if (!acc.dias[plan]) {
          acc.dias[plan] = [];
        }
        acc.dias[plan].push({
          diaCursado,
          horaInicio,
          horaFin,
        });
        return acc;
      }
    },
    horarios[0]
  );
  try {
    fs.writeFileSync(
      "./parsedTable.json",
      JSON.stringify(finalResult, null, 2)
    );
  } catch (e) {
    console.log(e);
  }
  return finalResult;
}
function parseHTMLRow(row: string): ParsedRow {
  // SE PUED HACER TAMBIÉN CON REGEX EN VEZ DE SPLIT() Y JOIN()
  const info = row
    .split("<td>")
    .join("")
    .split("</td>")
    .map((e) => e.trimStart());
  return {
    año: info[0],
    dictado: info[1],
    materia: info[2],
    curso: info[3],
    plan: info[4],
    diaCursado: info[5],
    horaInicio: info[6],
    horaFin: info[7],
  };
}
