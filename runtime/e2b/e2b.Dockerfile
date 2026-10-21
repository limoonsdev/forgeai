# E2B sandbox template for Forged project VMs.
# Build with:  cd runtime && e2b template build -n forged-nextjs -d e2b/e2b.Dockerfile
FROM e2bdev/code-interpreter:latest

ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=development

WORKDIR /home/user/app
COPY template/package.json ./package.json
RUN npm install --no-audit --no-fund && chown -R user:user /home/user/app
