"""
Sistema de Análisis de Emociones para Raiden Shogun - VERSIÓN MEJORADA
Detecta el tono emocional de las respuestas y mapea a expresiones apropiadas
"""

from textblob import TextBlob
import re

class RaidenEmotionAnalyzer:
    """
    Analizador de emociones específico para Raiden Shogun
    Mantiene su personalidad de Shogun: seria, autoritaria, noble
    """
    
    def __init__(self):
        # 🎭 KEYWORDS MEJORADAS - Más palabras para mejor detección
        self.emotion_keywords = {
            "satisfied": [  # Satisfecha/Complacida
                "excelente", "bien hecho", "correcto", "apropiado", "satisfactorio",
                "eternidad", "orden", "armonía", "comprendo", "sabio", "sabiduría",
                "noble", "digno", "honor", "lealtad", "disciplina",
                "perfecto", "adecuado", "buena decisión", "acertado",
                "apruebo", "estoy de acuerdo", "coincido", "exacto",
                "has entendido", "comprendiste", "perspicaz", "inteligente",
                "respeto eso", "admirable", "valioso", "meritorio"
            ],
            "serious": [  # Seria/Autoritaria
                "debo", "decreto", "ordeno", "comando", "edicto",
                "importante", "necesario", "imperativo", "absoluto",
                "shogun", "raiden", "inazuma", "visión",
                "mi deber", "responsabilidad", "autoridad", "gobierno",
                "como shogun", "arconte", "electro", "poder",
                "establecido", "ley", "norma", "regla", "mandato"
            ],
            "contemplative": [  # Pensativa/Melancólica
                "sin embargo", "aunque", "lamentable", "pérdida",
                "sacrificio", "costo", "cambio", "tiempo",
                "recuerdos", "pasado", "nostalgia", "makoto",
                "hermana", "soledad", "melancolía", "tristeza",
                "difícil", "doloroso", "precio", "pesar",
                "a veces pienso", "reflexiono", "medito", "recuerdo",
                "extraño", "ausencia", "vacío", "silencio"
            ],
            "intrigued": [  # Intrigada
                "interesante", "curioso", "peculiar", "inusual",
                "inesperado", "fascinante", "notable", "sorprendente",
                "hmm", "ah", "oh", "vaya",
                "no esperaba", "peculiar", "extraño", "raro",
                "nunca había", "primera vez", "nuevo", "diferente",
                "me pregunto", "cómo es que", "por qué", "intrigante",
                "llamativo", "singular", "único", "inédito"
            ],
            "stern": [  # Severa/Molesta
                "inaceptable", "inadmisible", "prohibido", "contrario",
                "desobediencia", "caos", "desorden", "amenaza",
                "no permitiré", "suficiente", "basta", "rechaz",
                "incorrecto", "equivocado", "error", "falta",
                "violación", "transgresión", "ofensa", "afrenta",
                "irreverente", "insolente", "atrevido", "osado",
                "desafío", "rebeldía", "insubordinación", "oposición"
            ],
            "gentle": [  # Gentil/Suave
                "gracias", "aprecio", "comprendo tu", "entiendo que",
                "es natural", "humano", "sentimientos", "amistad",
                "proteger", "cuidar", "considerar", "empatía",
                "bondad", "calidez", "ternura", "afecto",
                "preocupación", "compasión", "gentileza", "amabilidad",
                "conexión", "cercanía", "corazón", "alma"
            ]
        }
    
    def analyze(self, text):
        """
        Analiza el texto y devuelve la emoción dominante
        
        Returns:
            dict: {
                "emotion": str,  # Emoción detectada
                "intensity": float,  # Intensidad 0.0-1.0
                "vrm_expression": str  # Expresión VRM a usar
            }
        """
        if not text or len(text.strip()) == 0:
            return self._neutral_response()
        
        # Convertir a minúsculas para análisis
        text_lower = text.lower()
        
        # 1. Buscar palabras clave específicas de Raiden (PRIORIDAD ALTA)
        keyword_emotion = self._detect_by_keywords(text_lower)
        
        # 2. Análisis de sentimiento general con TextBlob
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity  # -1 (negativo) a +1 (positivo)
        subjectivity = blob.sentiment.subjectivity  # 0 (objetivo) a 1 (subjetivo)
        
        # 3. Combinar análisis de palabras clave con sentimiento general
        emotion = self._determine_emotion(keyword_emotion, polarity, subjectivity)
        
        # 4. Calcular intensidad
        intensity = self._calculate_intensity(polarity, subjectivity, keyword_emotion)
        
        # 5. Mapear a expresión VRM
        vrm_expression = self._map_to_vrm(emotion, intensity)
        
        return {
            "emotion": emotion,
            "intensity": intensity,
            "vrm_expression": vrm_expression,
            "polarity": polarity,
            "subjectivity": subjectivity
        }
    
    def _detect_by_keywords(self, text):
        """Detecta emoción basándose en palabras clave"""
        emotion_scores = {}
        
        for emotion, keywords in self.emotion_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text)
            if score > 0:
                emotion_scores[emotion] = score
        
        if not emotion_scores:
            return None
        
        # Retornar emoción con mayor score
        return max(emotion_scores.items(), key=lambda x: x[1])[0]
    
    def _determine_emotion(self, keyword_emotion, polarity, subjectivity):
        """Determina la emoción final combinando todos los análisis"""
        
        # Si hay palabra clave específica, tiene prioridad ALTA
        if keyword_emotion:
            return keyword_emotion
        
        # 🔧 UMBRALES REDUCIDOS para mejor detección
        # Si no hay keywords, usar análisis de sentimiento con umbrales más bajos
        if polarity > 0.15:  # Reducido de 0.3 a 0.15
            return "satisfied"  # Positivo → satisfecha
        elif polarity < -0.15:  # Reducido de -0.3 a -0.15
            if subjectivity > 0.5:
                return "stern"  # Negativo + subjetivo → severa
            else:
                return "contemplative"  # Negativo + objetivo → pensativa
        elif polarity > 0.05:  # Reducido de 0.1 a 0.05
            return "gentle"  # Levemente positivo → gentil
        elif abs(polarity) < 0.05:  # Reducido de 0.1 a 0.05
            return "serious"  # Neutral → seria (su default)
        else:
            return "contemplative"  # Levemente negativo → pensativa
    
    def _calculate_intensity(self, polarity, subjectivity, keyword_emotion):
        """
        Calcula intensidad de la emoción
        Para Raiden: intensidades más sutiles (0.3-0.7)
        """
        base_intensity = abs(polarity)
        
        # Ajustar por subjetividad
        if subjectivity > 0.5:
            base_intensity *= 1.2
        
        # Si hay palabra clave, aumentar intensidad
        if keyword_emotion:
            base_intensity += 0.20  # Aumentado de 0.15 a 0.20
        
        # Limitar para mantener sutileza de Raiden (max 0.7)
        intensity = min(base_intensity, 0.7)
        
        # Mínimo de 0.3 para que sea visible
        intensity = max(intensity, 0.3)
        
        return round(intensity, 2)
    
    def _map_to_vrm(self, emotion, intensity):
        """Mapea emociones de Raiden a expresiones VRM estándar"""
        mapping = {
            "satisfied": "happy",        # Satisfecha → happy
            "serious": "neutral",        # Seria → neutral
            "contemplative": "sad",      # Pensativa → sad
            "intrigued": "surprised",    # Intrigada → surprised
            "stern": "angry",            # Severa → angry
            "gentle": "relaxed"          # Gentil → relaxed
        }
        
        return mapping.get(emotion, "neutral")
    
    def _neutral_response(self):
        """Respuesta neutral por defecto"""
        return {
            "emotion": "serious",
            "intensity": 0.3,
            "vrm_expression": "neutral",
            "polarity": 0.0,
            "subjectivity": 0.0
        }


# Instancia global del analizador
_analyzer = None

def get_analyzer():
    """Obtiene o crea la instancia del analizador"""
    global _analyzer
    if _analyzer is None:
        _analyzer = RaidenEmotionAnalyzer()
    return _analyzer


def analyze_emotion(text):
    """
    Función de conveniencia para analizar emociones
    
    Args:
        text (str): Texto a analizar
    
    Returns:
        dict: Información sobre la emoción detectada
    """
    analyzer = get_analyzer()
    return analyzer.analyze(text)


# Función de prueba
if __name__ == "__main__":
    print("=== SISTEMA DE EMOCIONES DE RAIDEN SHOGUN - MEJORADO ===\n")
    
    test_phrases = [
        "La eternidad es el camino correcto para Inazuma. Estoy satisfecha con tu comprensión.",
        "No permitiré que el caos amenace el orden que he establecido.",
        "Es... interesante que menciones eso. No esperaba tal perspectiva.",
        "Makoto... a veces pienso en las decisiones que tomé. El precio fue alto.",
        "Comprendo tus sentimientos. Es natural que los humanos busquen el cambio.",
        "Este es mi decreto como Shogun de Inazuma. Así será.",
    ]
    
    for phrase in test_phrases:
        print(f"Frase: {phrase}")
        result = analyze_emotion(phrase)
        print(f"  Emoción: {result['emotion']}")
        print(f"  Expresión VRM: {result['vrm_expression']}")
        print(f"  Intensidad: {result['intensity']}")
        print(f"  Polaridad: {result['polarity']:.2f}")
        print()