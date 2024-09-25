import { StringDecoder } from "node:string_decoder";
import htmlTableToObject from "./parser.js";
import fs from "node:fs";
export var Especialidades;
(function (Especialidades) {
    Especialidades["SISTEMAS"] = "5";
    Especialidades["ELECTRONICA"] = "9";
    Especialidades["CIVIL"] = "31";
    Especialidades["ELECTROMECANICA"] = "8";
    Especialidades["TELECOMUNICACIONES"] = "15";
    Especialidades["QUIMICA"] = "27";
})(Especialidades || (Especialidades = {}));
export async function getHorariosCursado(especialidad) {
    const formData = new URLSearchParams();
    formData.append("especialidad", especialidad);
    try {
        const response = await fetch("http://encuesta.frm.utn.edu.ar/horariocurso/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
        });
        const decoder = new StringDecoder("latin1");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const textDecoded = decoder.write(buffer);
        return textDecoded;
    }
    catch (e) {
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
            return fs.writeFile(`../../horarios/parsed-${i}.json `, JSON.stringify(await htmlTableToObject(h), null, 2), (e) => console.log(e));
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
            .map((h) => JSON.parse(h))
            .reduce((acc, currentValue) => {
            acc = [...acc, ...currentValue];
            return acc;
        });
        console.log(horarios.map((e) => e.materia).join(","));
        return horarios;
    }
    catch (error) {
        console.log(error);
    }
}
export async function searchHorario(materia, curso) {
    const horarios = await loadHorarios();
    const materiaNormalizada = normalize(materia);
    let cursoNormalizado = normalize(curso);
    if (cursoNormalizado.length === 3) {
        const firstPart = cursoNormalizado.slice(0, 2);
        cursoNormalizado = firstPart + "0" + cursoNormalizado.charAt(2);
    }
    const found = horarios.filter((e) => {
        if (normalize(e.materia) === materiaNormalizada &&
            normalize(e.curso) === cursoNormalizado) {
            return e;
        }
    });
    if (found.length === 0) {
        console.log("Horario no encontrado");
        return { data: null };
    }
    return { data: found };
}
export function prettyPrintForWhatsApp(horario) {
    let result = `📚 *Materia*: ${horario.materia}\n📅 *Año*: ${horario.año}\n🗂 *Curso*: ${horario.curso}\n🔢 *Dictado*: ${horario.dictado}\n\n`;
    for (const plan in horario.dias) {
        result += `📝 *${plan}*\n`;
        horario.dias[plan].forEach((dia) => {
            result += `   📅 *${dia.diaCursado}*: ${dia.horaInicio} - ${dia.horaFin}\n`;
        });
        result += "\n";
    }
    result +=
        "Fuente: http://encuesta.frm.utn.edu.ar/horariocurso/ \n Por favor, corroborar.";
    return result.trim();
}
export default function normalize(text) {
    return text
        .toLowerCase()
        .trimStart()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
}
