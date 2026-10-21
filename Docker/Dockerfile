FROM postgres:16

# Скрипты из этой папки выполняются один раз при первом создании пустого тома с данными,
# в алфавитном порядке, от имени POSTGRES_USER в базе POSTGRES_DB
COPY init/ /docker-entrypoint-initdb.d/

EXPOSE 5432
