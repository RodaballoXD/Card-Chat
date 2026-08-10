import { shuffle } from "../shared/helpers.js";
import type { Card } from "../shared/types.js";

export class CardList {
    private uuidCount: number = 0;
    private presetCards: string[] = [
        "Mi tostadora tiene una orden de alejamiento",
        "El vecino volvió a invocar algo raro",
        "Mi perro sabe demasiado sobre mí",
        "Un pato me debe dinero",
        "Mi ex vive dentro de mi WiFi",
        "La nevera me está ignorando",
        "Acabo de perder una pelea contra una puerta",
        "Mi madre encontró mi carpeta secreta",
        "El champú conoce mis crímenes",
        "Un señor del bus me eligió como heredero",
        "Mi móvil me pidió perdón",
        "La paloma de la plaza me vigila",
        "Mi gato tiene una segunda familia",
        "He sido baneado de la realidad",
        "El universo me ha denunciado",
        "Mi cerebro está en modo avión",
        "Un desconocido sabe mi contraseña",
        "La lavadora me ha traicionado",
        "Mi planta murió decepcionada de mí",
        "El microondas está planeando algo",
        "Le mandé un mensaje y ahora vivo con miedo",
        "Mi crush descubrió todo",
        "Mi ex volvió a aparecer",
        "Me enamoré de una persona horrible",
        "Me dejó por alguien con mejor WiFi",
        "Mi historial de búsqueda me destruiría",
        "Mi madre leyó el grupo equivocado",
        "Le di like a una foto de 2017",
        "Me pillaron stalkeando",
        "Me enamoré de alguien que no existe",
        "Era mi primo todo este tiempo",
        "Me rechazó delante de todos",
        "Le envié el audio equivocado",
        "Mi dignidad abandonó el chat",
        "He fingido saber algo durante años",
        "Mi mayor talento es equivocarme",
        "Mentí y ahora tengo que mantenerlo",
        "Mi secreto salió en una cena familiar",
        "He tomado la peor decisión posible",
        "Volví a confiar en esa persona",
        "Mi amigo tiene un fetiche muy raro",
        "Mi vecino sabe demasiado de mis horarios",
        "Me pillaron haciendo algo ilegalmente estúpido",
        "La policía no quiere hablar de esto",
        "Mi abogado recomienda silencio",
        "No puedo explicar por qué hay una cabra aquí",
        "El médico dijo que era preocupante",
        "Mi búsqueda de Google parece una amenaza",
        "Mi madre encontró mi historial",
        "Hay fotos que nunca deberían existir",
        "No era mi cuenta falsa",
        "Nunca debí abrir ese enlace",
        "Mi profesor no puede enterarse",
        "Mi familia no puede saberlo",
        "Alguien encontró mis notas privadas",
        "Tengo una explicación, pero es peor",
        "Un sacerdote, un pato y una impresora rota",
        "Tres horas discutiendo con una tostadora",
        "Una guerra civil entre mis calcetines",
        "Un bebé con demasiadas responsabilidades",
        "Un caballo haciendo negocios turbios",
        "Una secta de señoras del bingo",
        "Una ardilla con problemas legales",
        "Una abuela con sed de venganza",
        "Un pez que sabe demasiado",
        "Un semáforo emocionalmente inestable",
        "Un enchufe con ansiedad social",
        "Un ladrillo que habla francés",
        "Una patata con ambiciones políticas",
        "Un vampiro con miedo a la sangre",
        "Un fantasma demasiado dramático",
        "Un mosquito con rencor personal",
        "Mi culo tiene más personalidad que yo",
        "Un desconocido me pidió una foto rara",
        "Mi búsqueda más vergonzosa",
        "El peor mensaje que he enviado",
        "Una captura que destruiría mi vida",
        "Una conversación que nunca debió existir",
        "Mi mayor red flag",
        "Algo que ocultaría hasta morir",
        "Una decisión tomada con cero neuronas",
        "Una historia que no contaré a mis hijos",
        "El peor consejo que seguí",
        "Mi peor error a las 3 AM",
        "Una idea que parecía buena borracho",
        "Una mentira mantenida durante años",
        "Algo que definitivamente no debería decir",
        "Mi colección secreta de calcetines usados",
        "Un tutorial para ser peor persona",
        "Una botella de aceite con intenciones raras",
        "Mi tío descubriendo internet",
        "Una foto que nadie pidió",
        "Un grupo de WhatsApp de ancianos criminales",
        "Una IA enamorada de una calculadora",
        "Una silla que me juzga",
        "Un bocadillo emocionalmente roto",
        "Un dinosaurio pagando impuestos",
        "Una patata con complejo de superioridad",
        "Un router con problemas de pareja",
        "Un GPS que quiere venganza",
        "Una cucaracha con estudios universitarios",
        "Un ladrón demasiado educado",
        "Un asesino que pide perdón antes"
    ];
    private remainingCards: string[] = [];

    constructor() {
        this.presetCards = shuffle(this.presetCards);
        this.remainingCards = [...this.presetCards];
    }


    uuid() {
        return this.uuidCount++;
    }

    presetCard(): Card {
        if (this.remainingCards.length === 0) this.remainingCards = [...this.presetCards];
        return {
            uuid: this.uuid(),
            creatorId: null,
            content: this.remainingCards.pop()!
        };
    }
}
