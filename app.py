import os, time, threading, traceback, hashlib
from flask import Flask, send_from_directory, Response, jsonify
from flask_socketio import SocketIO
from gtts import gTTS
from openai import OpenAI
import speech_recognition as sr
from pathlib import Path
Path("static").mkdir(exist_ok=True)

# 🎭 NUEVO: Sistema de expresiones emocionales
try:
    from emotion_analyzer import analyze_emotion
    EMOTION_ENABLED = True
    print("✅ Sistema de expresiones emocionales activado")
except ImportError:
    EMOTION_ENABLED = False
    print("⚠️ Sistema de expresiones emocionales no disponible")
    print("   Instala: pip install textblob --break-system-packages")
    print("   Luego: python -m textblob.download_corpora")

# === importa tu config ===
try:
    import config
except Exception:
    class Dummy: pass
    config = Dummy()
    config.api_key = os.environ.get("OPENAI_API_KEY","")
    config.waifu_context = "Eres una asistente amable y directa."

# === paths ===
AUDIO_PATH = os.path.join("static", "out.mp3")
AUDIO_META_PATH = os.path.join("static", "audio_meta.json")

# === Flask + SocketIO ===
app = Flask(__name__, 
            static_folder='web/static',
            static_url_path='/static',
            template_folder='web')
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# === Variable global para tracking ===
current_audio_id = None
current_audio_text = ""

# === CORS Headers ===
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Range')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Accept-Ranges', 'bytes')
    response.headers.add('Cache-Control', 'no-cache, no-store, must-revalidate')
    return response

# === Rutas estáticas / VRM ===
@app.route("/")
def root(): 
    return send_from_directory("web", "index.html")

@app.route("/web/<path:p>")
def send_web(p): 
    return send_from_directory("web", p)

@app.route("/static/<path:filename>")
def send_static(filename):
    """Ruta específica para archivos estáticos con headers apropiados para audio e imágenes"""
    try:
        # Buscar primero en web/static (para iconos PWA)
        web_static_path = os.path.join("web", "static", filename)
        static_path = os.path.join("static", filename)
        
        # Determinar qué archivo usar
        if os.path.exists(web_static_path):
            file_path = web_static_path
            base_dir = os.path.join("web", "static")
            print(f"[STATIC] ✅ Encontrado en web/static: {filename}")
        elif os.path.exists(static_path):
            file_path = static_path
            base_dir = "static"
            print(f"[STATIC] ✅ Encontrado en static: {filename}")
        else:
            print(f"[STATIC] ❌ Archivo no encontrado: {filename}")
            print(f"  - Intenté: {web_static_path}")
            print(f"  - Intenté: {static_path}")
            return "File not found", 404
        
        # Manejar archivos PNG (iconos)
        if filename.endswith('.png'):
            return send_from_directory(base_dir, os.path.basename(filename), 
                                     mimetype='image/png')
        
        # Manejar archivos MP3 (audio streaming)
        elif filename.endswith('.mp3'):
            def generate():
                with open(file_path, 'rb') as f:
                    data = f.read(1024)
                    while data:
                        yield data
                        data = f.read(1024)
            
            return Response(generate(), 
                          mimetype="audio/mpeg",
                          headers={
                              'Content-Disposition': 'inline',
                              'Accept-Ranges': 'bytes',
                              'Content-Type': 'audio/mpeg'
                          })
        
        # Otros archivos
        else:
            return send_from_directory(base_dir, os.path.basename(filename))
            
    except Exception as e:
        print(f"[STATIC] ❌ Error sirviendo {filename}: {repr(e)}")
        traceback.print_exc()
        return "Server error", 500

# === NUEVA RUTA: Metadata del audio ===
@app.route('/audio/metadata')
def audio_metadata():
    """Devuelve información del audio actual para evitar repeticiones"""
    global current_audio_id, current_audio_text
    
    try:
        if os.path.exists(AUDIO_PATH) and current_audio_id:
            return jsonify({
                'id': current_audio_id,
                'text': current_audio_text,
                'timestamp': int(os.path.getmtime(AUDIO_PATH)),
                'size': os.path.getsize(AUDIO_PATH)
            })
        else:
            return jsonify({'id': None}), 404
    except Exception as e:
        print(f"[METADATA] Error: {repr(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/audio/current')
def current_audio():
    """Ruta específica para el audio TTS actual"""
    try:
        if os.path.exists(AUDIO_PATH):
            print(f"[AUDIO_ROUTE] ✅ Sirviendo: {AUDIO_PATH}")
            response = send_from_directory("static", "out.mp3", 
                                         mimetype='audio/mpeg',
                                         as_attachment=False)
            
            response.headers['Accept-Ranges'] = 'bytes'
            response.headers['Cache-Control'] = 'no-cache'
            response.headers['Last-Modified'] = str(int(os.path.getmtime(AUDIO_PATH)))
            return response
        else:
            print(f"[AUDIO_ROUTE] ❌ Archivo no existe: {AUDIO_PATH}")
            return "No audio available", 404
    except Exception as e:
        print(f"[AUDIO_ROUTE] ❌ Error: {repr(e)}")
        return f"Server error: {e}", 500

@app.route("/Raiden_Shogun.vrm")
def send_vrm(): 
    return send_from_directory(".", "Raiden_Shogun.vrm")

@app.route("/Modelo_IA/<path:p>")
def send_modelo(p): 
    return send_from_directory("Modelo_IA", p)

@app.route("/test-audio")
def test_audio():
    """Ruta para probar que el servidor está funcionando"""
    return f"""
    <h1>Test Audio Server</h1>
    <p>Servidor funcionando en puerto {os.environ.get('PORT', '7861')}</p>
    <audio controls>
        <source src="/audio/current?v={int(time.time())}" type="audio/mpeg">
        Tu navegador no soporta audio.
    </audio>
    <br><br>
    <a href="/audio/current?v={int(time.time())}" target="_blank">Probar Ruta Audio Current</a>
    <br>
    <a href="/static/out.mp3?v={int(time.time())}" target="_blank">Probar Ruta Static</a>
    <br>
    <a href="/audio/metadata" target="_blank">Ver Metadata</a>
    """

# === RUTAS PWA ===
@app.route('/manifest.json')
def manifest():
    """Sirve el manifest para PWA"""
    response = send_from_directory('web', 'manifest.json')
    response.headers['Content-Type'] = 'application/json'
    response.headers['Cache-Control'] = 'no-cache'
    return response

@app.route('/service-worker.js')
def service_worker():
    """Sirve el service worker"""
    response = send_from_directory('web', 'service-worker.js')
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache'
    return response

# === RUTA DE DEBUG ===
@app.route('/debug/files')
def debug_files():
    """Ruta de debug para ver qué archivos encuentra Flask"""
    web_path = os.path.join(os.path.dirname(__file__), 'web')
    web_static_path = os.path.join(web_path, 'static')
    static_path = os.path.join(os.path.dirname(__file__), 'static')
    
    files = {
        'web_folder': os.listdir(web_path) if os.path.exists(web_path) else [],
        'web_static_folder': os.listdir(web_static_path) if os.path.exists(web_static_path) else [],
        'static_folder': os.listdir(static_path) if os.path.exists(static_path) else [],
        'web_path': web_path,
        'web_static_path': web_static_path,
        'static_path': static_path,
        'icon_192_exists': os.path.exists(os.path.join(web_static_path, 'icon-192.png')),
        'icon_512_exists': os.path.exists(os.path.join(web_static_path, 'icon-512.png'))
    }
    
    return jsonify(files)

# === LLM ===
client = OpenAI(api_key=getattr(config, "api_key", ""))
MODEL = "gpt-3.5-turbo"

def chat_answer(messages):
    """Genera respuesta de la IA"""
    try:
        resp = client.chat.completions.create(
            model=MODEL, 
            messages=messages, 
            max_tokens=250, 
            temperature=0.85
        )
        return resp.choices[0].message.content
    except Exception as e:
        print(f"[OpenAI] Error: {repr(e)}")
        return "Lo siento, hubo un problema con la conexión."

# === TTS ===
def tts_to_mp3(text, out_path=AUDIO_PATH):
    """Genera TTS con tracking mejorado"""
    global current_audio_id, current_audio_text
    
    try:
        print(f"[TTS] Generando audio para: '{text[:50]}...'")
        
        # Generar ID único basado en el contenido
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()[:12]
        timestamp = int(time.time() * 1000)
        audio_id = f"{timestamp}_{text_hash}"
        
        # Limpia archivo anterior
        if os.path.exists(out_path):
            try:
                os.remove(out_path)
                print("[TTS] Archivo anterior eliminado")
            except:
                pass
        
        tts = gTTS(text=text, lang='es', slow=False)
        tts.save(out_path)
        
        # Verificar que el archivo se creó correctamente
        if os.path.exists(out_path):
            size = os.path.getsize(out_path)
            print(f"[TTS] ✅ Archivo creado: {out_path} ({size} bytes)")
            
            if size > 100:
                # Actualizar metadata global
                current_audio_id = audio_id
                current_audio_text = text
                print(f"[TTS] 🆔 Audio ID: {audio_id}")
                
                return max(1200, int(len(text) * 55))
            else:
                print(f"[TTS] ⚠️ Archivo muy pequeño ({size} bytes)")
                return 1200
        else:
            print("[TTS] ❌ ERROR: Archivo no se creó")
            return 1200
            
    except Exception as e:
        print(f"[TTS] ❌ Error: {repr(e)}")
        traceback.print_exc()
        try:
            with open(out_path, "wb") as f:
                pass
        except:
            pass
        return 1200

# === Heurística de 'mood' ===
def classify_mood(text):
    t = text.lower()
    if any(w in t for w in ["genial","perfecto","excelente","me alegra","maravill"]): return "positive"
    if any(w in t for w in ["lo siento","lament","triste"]): return "sad"
    if "?" in t or any(w in t for w in ["curioso","veamos","analic"]): return "curious"
    return "neutral"

# === Micrófono ===
MIC_HINTS = ["Jabra", "Realtek", "USB", "Microphone", "Mic", "CABLE", "VB-Audio"]

def choose_mic_index():
    """Devuelve (idx, names). Elige por pista o el primero disponible."""
    try:
        names = sr.Microphone.list_microphone_names()
    except Exception as e:
        print("[Mic] No pude listar micrófonos:", repr(e))
        return None, []
    if not names:
        print("[Mic] No hay dispositivos de entrada detectados.")
        return None, []
    idx = None
    for i, name in enumerate(names):
        if not name:
            continue
        if any(h.lower() in name.lower() for h in MIC_HINTS):
            idx = i
            break
    if idx is None:
        idx = 0
    print("[Mic] Disponibles:", names)
    print(f"[Mic] Usaré idx={idx} → {names[idx]}")
    return idx, names

# === Bucle principal MEJORADO ===
def assistant_loop():
    r = sr.Recognizer()
    
    # ⚙️ AJUSTES CRÍTICOS PARA RECONOCIMIENTO DE VOZ
    r.pause_threshold = 5.0  # ⬆️ Aumentado de 0.8 a 5.0 segundos
                              # Espera más tiempo antes de decidir que terminaste
    
    r.energy_threshold = 300  # Sensibilidad al ruido (100-4000)
                              # Más bajo = más sensible
                              # Más alto = ignora más ruido de fondo
    
    r.dynamic_energy_threshold = True  # Ajusta automáticamente según ambiente
    
    r.dynamic_energy_adjustment_damping = 0.15
    r.dynamic_energy_ratio = 1.5
    
    messages = [{"role":"system","content":getattr(config,"waifu_context",
                      "Eres una asistente amable y directa.")}]

    mic_index, _ = choose_mic_index()

    # Bienvenida
    bienvenida = "Has invocado a la Shogun Raiden. Elige tus palabras con sabiduría."
    mood = classify_mood(bienvenida)
    dur = tts_to_mp3(bienvenida)
    
    # 🎭 NUEVO: Analizar emoción de la bienvenida
    if EMOTION_ENABLED:
        emotion_data = analyze_emotion(bienvenida)
        print(f"[EMOTION] 🎭 Bienvenida: {emotion_data['emotion']} → {emotion_data['vrm_expression']}")
        socketio.emit('emotion_change', {
            'emotion': emotion_data['emotion'],
            'vrm_expression': emotion_data['vrm_expression'],
            'intensity': emotion_data['intensity']
        })
    
    time.sleep(0.5)
    
    socketio.emit("msg", {"type":"speak_start","text":bienvenida,"duration_ms":dur,"mood":mood})
    time.sleep(dur/1000 + 0.15)
    socketio.emit("msg", {"type":"speak_end"})

    # Cooldown para evitar repeticiones
    last_response_time = 0
    cooldown_seconds = 2

    while True:
        try:
            print("[Escuchando…]")

            if mic_index is None:
                mic_index, _ = choose_mic_index()
                if mic_index is None:
                    time.sleep(2.0)
                    continue

            with sr.Microphone(device_index=mic_index, sample_rate=16000) as src:
                # ⚙️ Ajuste de ruido ambiental (0.5 → 1.0 segundos)
                print("[Mic] Calibrando ruido ambiental...")
                r.adjust_for_ambient_noise(src, duration=1.0)
                
                # ⚙️ Parámetros ajustados para mejor captura
                print("[Mic] Listo para escuchar. Habla ahora...")
                audio = r.listen(
                    src, 
                    timeout=40,           # ⬆️ Aumentado: espera hasta 40s que empieces
                    phrase_time_limit=60  # ⬆️ Aumentado: permite frases hasta 60s
                )

            print("[Mic] Audio capturado, procesando...")

            try:
                question = r.recognize_google(audio, language="es-ES")
            except sr.WaitTimeoutError:
                print("[Mic] ⏱️ Timeout sin voz")
                continue
            except sr.UnknownValueError:
                print("[ASR] ❌ No entendí (ruido o silencio)")
                continue
            except sr.RequestError as e:
                print("[ASR] ❌ Falla de servicio:", e)
                continue

            # ✅ COOLDOWN: Evitar respuestas duplicadas rápidas
            current_time = time.time()
            if current_time - last_response_time < cooldown_seconds:
                print(f"[COOLDOWN] ⏸️ Esperando {cooldown_seconds}s entre respuestas...")
                continue
            
            print(f"[Tú] 💬 {question}")
            messages.append({"role":"user","content":question})

            print("[Shogun] 🤔 Pensando...")
            answer = chat_answer(messages)
            print(f"[Shogun] 💜 {answer}")
            
            # 🎭 NUEVO: Analizar emoción de la respuesta
            if EMOTION_ENABLED:
                emotion_data = analyze_emotion(answer)
                print(f"[EMOTION] 🎭 {emotion_data['emotion']} → {emotion_data['vrm_expression']} (intensidad: {emotion_data['intensity']})")
                
                # Enviar emoción al frontend
                socketio.emit('emotion_change', {
                    'emotion': emotion_data['emotion'],
                    'vrm_expression': emotion_data['vrm_expression'],
                    'intensity': emotion_data['intensity']
                })
            
            mood = classify_mood(answer)

            dur = tts_to_mp3(answer)
            
            time.sleep(0.3)
            
            socketio.emit("msg", {"type":"speak_start","text":answer,"duration_ms":dur,"mood":mood})
            time.sleep(dur/1000 + 0.15)
            socketio.emit("msg", {"type":"speak_end"})
            messages.append({"role":"assistant","content":answer})
            
            last_response_time = current_time

        except sr.WaitTimeoutError:
            print("[Mic] ⏱️ Timeout esperando voz (loop)")
            continue
        except KeyboardInterrupt:
            print("\n[Server] 🛑 Deteniendo por usuario...")
            break
        except Exception as e:
            print(f"[Loop error] ❌ {repr(e)}")
            traceback.print_exc()
            mic_index = None
            time.sleep(0.8)

if __name__ == "__main__":
    os.makedirs("static", exist_ok=True)
    
    print("=" * 60)
    print("⚡ RAIDEN SHOGUN ASSISTANT - PWA + EMOTIONS ENABLED ⚡")
    print("=" * 60)
    print(f"🌐 URL: http://localhost:{os.environ.get('PORT', '7861')}")
    print(f"📂 Static folder: {os.path.abspath(app.static_folder)}")
    print(f"📂 Template folder: {os.path.abspath(app.template_folder)}")
    
    if EMOTION_ENABLED:
        print("🎭 Expresiones emocionales: ✅ ACTIVADAS")
    else:
        print("🎭 Expresiones emocionales: ⚠️ DESACTIVADAS")
        print("   Instala emotion_analyzer.py para activarlas")
    
    print("=" * 60)
    print("📋 Rutas registradas:")
    for rule in app.url_map.iter_rules():
        print(f"  • {rule.rule} → {rule.endpoint}")
    print("=" * 60)
    
    th = threading.Thread(target=assistant_loop, daemon=True)
    th.start()
    
    port = int(os.environ.get("PORT", "7861"))
    socketio.run(app, host="127.0.0.1", port=port, debug=False)