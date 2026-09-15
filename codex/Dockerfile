FROM cloudflare/sandbox:0.13.0-next.738.2@sha256:f4b2137219568aa44539ab93c0e774db6bcab323c134c5088447916e58f15e75
USER root
RUN npm install --global --omit=dev @openai/codex@0.147.0
RUN mkdir -p /opt/learning /learning/output /learning/previous /root/.codex \
    && npm install --prefix /opt/learning --omit=dev playwright@1.63.0 \
    && /opt/learning/node_modules/.bin/playwright install --with-deps chromium
COPY codex/supervisor.mjs codex/protocol.mjs /opt/learning/
RUN node --check /opt/learning/supervisor.mjs && codex --version
