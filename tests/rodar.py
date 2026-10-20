"""Roda os testes do Hábitos: python tests/rodar.py

Sobe um servidor local com a pasta do app, abre tests/index.html no Edge (ou Chrome) sem janela
e mostra PASSOU/FALHOU de cada teste. Sai com código 1 se algum teste falhar.
"""
import http.server, os, shutil, socket, subprocess, sys, tempfile, threading

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAVEGADORES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
]
resultado, pronto = [], threading.Event()
versao_teste = [None]   # o teste de versão nova troca a versão que o servidor entrega


class Servidor(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=PASTA, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if versao_teste[0] and self.path.split('?')[0] == '/js/versao.js':
            corpo = f"const VERSAO = '{versao_teste[0]}';".encode()
            self.send_response(200); self.send_header('Content-Type', 'text/javascript'); self.send_header('Content-Length', str(len(corpo)))
            self.end_headers(); self.wfile.write(corpo); return
        super().do_GET()

    def do_POST(self):
        if self.path == '/__versao':
            v = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode().strip()
            versao_teste[0] = v if v.isalnum() else None
            self.send_response(204); self.end_headers(); return
        if self.path != '/__resultado':
            self.send_error(404); return
        resultado.append(self.rfile.read(int(self.headers.get('Content-Length', 0))).decode('utf-8'))
        self.send_response(204); self.end_headers(); pronto.set()

    def log_message(self, *a):
        pass


class Http(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # O navegador fecha conexões no meio quando um teste troca de página: isso não é erro do app.
        if isinstance(sys.exc_info()[1], (ConnectionAbortedError, ConnectionResetError, BrokenPipeError)): return
        super().handle_error(request, client_address)


def porta_livre():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); return s.getsockname()[1]


def main():
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    nav = next((n for n in NAVEGADORES if os.path.exists(n)), None)
    if not nav:
        print('Não achei o Edge nem o Chrome. Abra tests/index.html por um servidor http e veja o resultado na página.'); return 2
    porta = porta_livre()
    srv = Http(('127.0.0.1', porta), Servidor)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    perfil = tempfile.mkdtemp(prefix='habitos-testes-')
    proc = subprocess.Popen([nav, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + perfil,
                             f'http://127.0.0.1:{porta}/tests/index.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not pronto.wait(180):
            print('Os testes não terminaram em 3 minutos.'); return 1
    finally:
        proc.terminate()
        try: proc.wait(10)
        except subprocess.TimeoutExpired: proc.kill()
        srv.shutdown(); shutil.rmtree(perfil, ignore_errors=True)
    texto = resultado[0]
    print(texto)
    return 1 if 'FALHOU' in texto else 0


if __name__ == '__main__':
    sys.exit(main())
