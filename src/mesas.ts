import { google, calendar_v3 } from "googleapis";
import { calendar } from "./calendar.js";
type DateForSubject = {
  day: string;
  degree: string;
  subject: string;
};
export async function listUpcomingEvents() {
  try {
    const res = await calendar.events.list({
      calendarId: "qf08mgc7b6md0idbeqr53ppod8@group.calendar.google.com",
      timeMin: new Date().toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: "startTime",
    });
    const events = res.data.items;
    if (events.length) {
      return events;
    } else {
      console.log("No upcoming events found.");
    }
  } catch (error) {
    console.error("Error retrieving events:", error);
  }
}
function parseEventDescription(events: calendar_v3.Schema$Event[]) {
  const dias = new Map<string, Map<string, string[]>>();
  events.forEach((e) => {
    if (e.description) {
      const mapa = new Map<string, string[]>();
      let miarray = [];
      let counter = 0;
      const subjects = [];
      const lines: string[] = getLines(e.description);

      for (const p of lines) {
        if (p.startsWith("<b>")) {
          const subject = p.slice(3, -4);

          subjects.push(subject);
          if (counter !== 0) {
            mapa.set(subjects[counter - 1], miarray);
            miarray = [];
          }
          counter++;
        } else {
          if (p.trimEnd() !== p) {
            miarray.push(p.trimEnd());
          } else {
            miarray.push(p);
          }
        }
      }
      dias.set(e.start.dateTime || e.start.date, mapa);
    }
  });
  return dias;
}
export async function getAll() {
  const events = await listUpcomingEvents();
  const mapa = parseEventDescription(events);
  return mapEntriesToString(mapa);
}
export async function getBySubject(subject: string) {
  const events = await listUpcomingEvents();
  const mapa = parseEventDescription(events);
  const date = getDateForSubject(mapa, subject);
  if (!date) {
    console.log(date);
    return "No se encontraron fechas para la materia: " + subject;
  }
  const fechas = date.reduce((prev, current, index) => {
    return `${prev} ${current.day}${index === date.length - 1 ? "" : "\n"}`;
  }, `Las fechas para rendir la materia ${date[0].subject} son:\n`);
  return fechas;
}
function mapEntriesToString(entries: Map<string, any>, indentLevel = 0) {
  const indent = " ".repeat(indentLevel);
  return (
    Array.from(entries, ([k, v]) => {
      if (v instanceof Map) {
        return `${indent}*Dia: ${k}* ${mapEntriesToString(v, indentLevel + 1)}`;
      }
      if (v instanceof Array) {
        return `\n${indent}*_${k}_*\n - ${v.join("\n - ")}`;
      }
    }).join("") + "\n"
  );
}
const text = [
  {
    start: { date: "2024-08-26" },
    description:
      "<p>Mesas correspondientes al día <b>Jueves</b> (Actualizado: 2023)</p><p><br><b>BÁSICAS:</b></p><p>Química General (18h)</p><p>Probabilidad y Estadística (18h)</p><p>Legislación (18h)</p><p><b>CIVIL:</b></p><p>Tecnología de la Construcción </p><p>Vías de Comunicación I</p><p>Vías de Comunicación II </p><p>Diseño Geométrico de Carreteras </p><p>Construcción de Carreteras </p><p>Elasticidad y Plasticidad (Elec.) </p><p>Taller de Computación </p><p>Estructuras de Hormigón </p><p>Tecnología de los Materiales</p><p><b>ELECTRÓNICA: </b></p><p>Química General </p><p>Técnicas Digitales I </p><p>Técnicas Digitales II </p><p>Técnicas Digitales III </p><p>Teoría de Circuitos II </p><p>Tecnología Electrónica Técnicas Digitales IV (Elec) </p><p>Teleinformática<b> </b></p><p><b>ELECTROMECÁNICA: </b></p><p>Máquinas y Equipos Industriales </p><p>Mantenimiento Electromecánico</p><p>Máquinas Eléctricas </p><p>Redes de Distribución e Instalaciones </p><p>Eléctricas Hidrodinámica y Neumática (Elec) </p><p>Ingeniería Electromecánica I</p><p><b>SISTEMAS: </b></p><p>Análisis de Sistemas </p><p>Sistemas de Representación </p><p>Modelado de procesos de Negocios (Elec.) </p><p>Diseño de Sistemas </p><p>Comunicaciones </p><p>Administración de Recursos</p><p>Gobierno Electrónico (Elec.) </p><p>Nuevas Tecnologías de Redes (Elec.) </p><p>Taller de Programación Avanzada (Elec.) </p><p>Taller de Informática Forense (Elec.) </p><p>Desarrollo de Software dirigido por Modelos (Elec.) </p><p>Seguridad en Redes (Elec.)</p><p><b>QUÍMICA:</b></p><p>Química Analítica Aplicada (18h)</p><p>Gestión de RRHH (18h)</p><p>Evaluación de Impacto Ambiental (18h)</p><p>Organización Industrial (18h)</p><p>Integración II (Int. a Equipos y Procesos)</p><p>Matemática Superior Aplicada (18h)<br></p><p>Integración IV (Diseño, simulación, optimización y seguridad de procesos) (18h)</p><p>Higiene y Seguridad (18h)</p><p><br></p><p><br></p>",
  },
];
function getLines(description: string): string[] {
  return description
    .split("<p>")
    .join(";")
    .split("<b> </b>")
    .join(";")
    .split('<p dir="ltr">')
    .join(";")
    .split("<br>")
    .join(";")
    .split(";")
    .map((e) => e.slice(0, -4))
    .filter((e) => e !== "" && !e.startsWith("Mesa"));
}

function getDateForSubject(
  info: Map<string, Map<string, string[]>>,
  subject: string
): DateForSubject[] | null {
  const res = [];
  for (const [day, degrees] of info.entries()) {
    for (const [degree, subjects] of degrees.entries()) {
      console.log(subjects);
      const normalizedSubject = subject
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      const originalItem = subjects.find(
        (item) =>
          item
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "") === normalizedSubject
      );

      if (originalItem) {
        res.push({ day: day, degree: degree, subject: originalItem });
      }
    }
  }
  if (res.length === 0) {
    return null;
  }
  return res;
}
