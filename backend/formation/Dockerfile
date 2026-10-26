FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py lookup_server.py ./
ENV PYTHONUNBUFFERED=1 FORMATION_HOST=0.0.0.0 FORMATION_PORT=8081 COMPANIES_CSV=/data/companies.csv
EXPOSE 8081
CMD ["python", "lookup_server.py"]
