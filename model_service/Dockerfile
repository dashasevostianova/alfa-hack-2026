FROM python:3.12-slim
WORKDIR /app
COPY model_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY model_service/server.py ./server.py
COPY model/logistic_model.pkl model/scaler.pkl ./models/
ENV PYTHONUNBUFFERED=1 MODEL_HOST=0.0.0.0 MODEL_PORT=8082 MODEL_DIR=/app/models
EXPOSE 8082
CMD ["python", "server.py"]
