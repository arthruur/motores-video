FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
# o Hugging Face roda o Space como o usuário 1000
RUN useradd -m -u 1000 prensa
USER prensa
WORKDIR /home/prensa/app
COPY --chown=prensa requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
COPY --chown=prensa app.py .
ENV PATH="/home/prensa/.local/bin:$PATH"
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
