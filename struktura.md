# Структура проекта dev-2

Это актуальная карта всего репозитория. Запуск описан в [README.md](README.md), HTTP-контракт — в [docs/INTEGRATION.md](docs/INTEGRATION.md), состояние проверки и оставшиеся задачи — в [OSTALOS.md](OSTALOS.md).

## Каталоги и файлы

```text
alpha-front-for-dashka-kashka/
├── compose.yaml                     # Общий запуск всех сервисов
├── .env.example                     # Локальные настройки порта и новой БД
├── .gitignore                       # Исключает зависимости, сборки и локальные env
├── README.md                        # Установка, запуск, режим моков, проверки
├── struktura.md                     # Карта всего репозитория
├── OSTALOS.md                       # Готовность и задачи для продолжения
├── docs/
│   └── INTEGRATION.md               # Контракт текущего Java API
├── scripts/
│   └── check_integration.py         # Сквозная проверка локального стека
├── frontend/                        # React + TypeScript + Vite
│   ├── src/
│   │   ├── main.tsx                 # Подключение React к index.html
│   │   ├── App.tsx                  # Восстановление сессии и маршруты
│   │   ├── session.tsx              # Общий контекст пользователя
│   │   ├── types.ts                 # Модели профиля, продукта и заявки
│   │   ├── lib.ts                   # Платёж, форматирование, валидация
│   │   ├── lib.test.ts              # Тесты расчёта и валидации
│   │   ├── styles.css              # Общие стили и анимация формирования
│   │   ├── api/
│   │   │   ├── index.ts             # HTTP, cookies/CSRF, выбор реального API/моков
│   │   │   ├── formation.ts         # Типы отчёта и запросы формирования/ставок
│   │   │   ├── mock.ts              # Изолированная демо-база в браузере
│   │   │   └── mock.test.ts         # Проверки демо-сценария
│   │   ├── components/
│   │   │   ├── AuthLayout.tsx       # Оболочка входа и регистрации
│   │   │   ├── Layout.tsx           # Навигация кабинета и выход
│   │   │   ├── Field.tsx            # Поле ввода с подписью
│   │   │   └── StatusStepper.tsx    # Этапы рассмотрения заявки
│   │   └── pages/
│   │       ├── LoginPage.tsx        # /login
│   │       ├── RegisterPage.tsx     # /register
│   │       ├── DataPage.tsx         # /data: анкета, поиск ИНН, ручные сведения
│   │       ├── CalculatorPage.tsx   # /calculator: условия и ставка
│   │       ├── FormationPage.tsx    # /applications/:id/formation: анимация/отчёт
│   │       ├── ApplicationsPage.tsx # /applications: список и решения из API
│   │       └── ApprovedPage.tsx     # /approved/:id: предусмотренный ТЗ пустой этап
│   ├── Dockerfile                  # Сборка Vite и выдача через nginx
│   ├── nginx.conf                  # SPA fallback и /api → Java
│   ├── vite.config.ts              # Сервер разработки и прокси /api
│   ├── package.json                # npm run dev/build/test/preview
│   ├── package-lock.json           # Зафиксированные зависимости npm
│   ├── tsconfig*.json              # Проверка типов TypeScript
│   ├── .env.example                # Публичные настройки Vite
│   ├── .env.formation              # Совместимость прежнего режима, реальный API
│   ├── docs/API.md                 # Исторический контракт UI
│   └── struktura.md                # Подробная исходная карта фронтенда
├── backend/
│   ├── hack/                       # Java 25, Spring Boot, Maven
│   │   ├── pom.xml                 # Зависимости Java и плагины сборки
│   │   ├── mvnw, mvnw.cmd, .mvn/   # Maven Wrapper
│   │   ├── Dockerfile              # Сборка JAR и запуск JRE
│   │   └── src/
│   │       ├── main/resources/application.properties
│   │       ├── main/java/alpha/hack/
│   │       │   ├── HackApplication.java
│   │       │   ├── controller/      # HTTP-контроллеры auth/profile/products/applications
│   │       │   ├── dto/             # Контракты исходных Java-сервисов
│   │       │   ├── service/         # ProductService и транзакционный ApplicationService
│   │       │   ├── Entity/          # JPA-сущности существующих таблиц
│   │       │   ├── Repository/      # Spring Data JPA
│   │       │   ├── Enums/           # Значения статусов, целей, форм бизнеса
│   │       │   └── integration/     # Адаптер кабинета к исходному бэкенду
│   │       └── test/java/alpha/hack/
│   │           ├── service/ApplicationServiceTests.java
│   │           └── integration/ExternalServicesTests.java
│   └── formation/
│       ├── server.py               # Исходные расчёты CSV и прежний отдельный сервер
│       ├── lookup_server.py        # Read-only HTTP-оболочка для общего Compose
│       ├── data/companies_small.csv# Предоставленная таблица компаний
│       ├── requirements.txt        # Python-зависимости
│       ├── Dockerfile              # Запуск lookup_server.py
│       └── test*.py                # Проверки расчётов и HTTP-оболочки
├── parser/
│   ├── main.py                     # FastAPI, HTTP-интерфейс парсера
│   ├── parser.py                   # Playwright, выбор условий и извлечение ставок
│   ├── offers.py                   # Видимые карточки с названиями и единицами ставок
│   ├── test_offers.py              # Возраст бизнеса, продукты и месячная переплата
│   ├── links.py                    # Адрес источника
│   ├── requirements.txt            # Python, Playwright, BeautifulSoup
│   └── Dockerfile                  # Chromium и зависимости для Linux
├── Docker/
│   ├── init/
│   │   ├── 01_schema.sql           # Исходные таблицы, enum, проверки и триггеры
│   │   ├── 02_seed.sql             # Исходное начальное заполнение
│   │   └── 03_integration.sql      # Добавочная анкета и продукт для пустой БД
│   ├── docker-compose.yml          # Прежний отдельный запуск, не общий стек
│   ├── Dockerfile                  # Прежняя конфигурация
│   └── backup.sql                  # Существующий SQL-файл, не импортируется автоматически
└── DB/                             # Исходные SQL-фрагменты по таблицам
```

Названия каталогов `Entity`, `Repository`, `Enums` сохранены из исходного бэкенда; Java package внутри записан строчными буквами. `node_modules/`, `dist/`, `target/`, `__pycache__/` создаются инструментами и не являются исходным кодом. `.idea/` и `main.py` — локальные файлы PyCharm, для общего запуска не нужны.

## Как проходят данные

Браузер обращается к одному адресу `http://127.0.0.1:8088`. Nginx отдаёт собранный фронтенд и пересылает `/api` на Java. Только фронтенд публикует порт на Windows; остальные сервисы общаются во внутренней Docker-сети.

1. `App.tsx` восстанавливает пользователя через `/api/auth/me`. `AuthController` проверяет пароль в PostgreSQL, а `SessionAccess` защищает API сессией и CSRF.
2. `DataPage` запрашивает ИНН через Java → formation. `lookup_server.py` вызывает исходный `Module.prepare`, читает CSV и возвращает реквизиты/показатели. При отсутствии ИНН используются ручные поля анкеты.
3. `ProfileController` передаёт анкету в `IntegrationService.saveProfile`. Java заново проверяет данные через formation и сохраняет анкету с серверным результатом в `integration_profile.payload`.
4. `CalculatorPage` получает учебный каталог через `ProductController` и отдельные предложения банка через адаптер внешних сервисов. Возраст считается из даты регистрации: ООО — порог 9 месяцев, ИП — 3. Срок кредита задаётся отдельно. Пользователь выбирает предложение с годовой ставкой; месячная переплата и грейс-период не заменяют годовой процент. При ошибке источника отправка блокируется.
5. При POST `/api/applications` владелец берётся из сессии. `IntegrationService` проверяет параметры, повторно проверяет ставку и собирает исходный `ApplicationSubmission`. `ApplicationService` транзакционно сохраняет человека, бизнес, заявку и финансы.
6. JSON-снимок анкеты, подготовленных показателей и условий, включая выбранный `bankOffer`, попадает в `finances.account_statements`. Поэтому изменение анкеты не переписывает отчёт старой заявки.
7. `FormationPage` показывает анимацию и читает уже сохранённую заявку. `ApplicationsPage` получает список только текущего пользователя. Решение показывается, когда оно существует в БД; ML пока ожидает подключения.

## Основные Java-адаптеры

| Файл в integration/ | Ответственность |
| --- | --- |
| `SessionAccess.java` | Доступ к API по cookie-сессии, генерация и проверка CSRF |
| `ExternalServices.java` | HTTP к formation/parser, тайм-ауты, проверка и кэш ставок |
| `IntegrationService.java` | Анкета, сборка DTO существующего сервиса, снимки и чтение карточек |
| `ApiErrors.java` | Понятные JSON-ошибки без раскрытия внутренних SQL-данных |

## База данных

`reg` хранит аккаунт и хеш пароля; `person` — личные данные; `business` — реквизиты и владельца; `product` — каталог и пределы суммы/срока; `application` — заявку и статус; `finances` — показатели и снимок; `decision` — решение по заявке. В исходной схеме поле `decision.decision_id` ссылается на `application.id`, несмотря на название.

Добавлена только `integration_profile`: она позволяет сохранить анкету до выбора продукта и подачи заявки. Миграция `03_integration.sql` выполняется отдельным Compose-сервисом `migrate`, в том числе для уже созданного тома. Том `credit_pgdata` хранит данные между перезапусками. `docker compose down -v` удаляет его — для обычной остановки достаточно `docker compose down`.

## Где менять код

| Задача | Место |
| --- | --- |
| Поля анкеты | `frontend/src/pages/DataPage.tsx`, `types.ts`, `IntegrationService.saveProfile` |
| Вид входа/кабинета | `components/`, `pages/LoginPage.tsx`, `pages/RegisterPage.tsx`, `styles.css` |
| Формула платежа | `frontend/src/lib.ts` и `lib.test.ts` |
| Источник/разбор ставок | `parser/` и `ExternalServices.java`, контракт и тесты вместе |
| Расчёт финансов CSV | `backend/formation/server.py` и Python-тесты |
| Запись заявки | `IntegrationService.create` → `ApplicationService.submit` |
| Подключение будущей ML | Новый адаптер Java, сохранение `decision` и изменение статуса |
| Новая структура БД | Новая добавочная SQL-миграция с проверкой на существующем томе |
| Порты/сервисы | Корневой `compose.yaml`, `.env.example`, соответствующий Dockerfile |

## Моковый режим

По умолчанию используется Java API. Для самостоятельного фронтенда создайте `frontend/.env.local` с `VITE_USE_MOCKS=true`, затем выполните в `frontend` команды `npm.cmd ci` и `npm.cmd run dev`. `api/index.ts` выберет `mock.ts`; пользователи и заявки будут храниться в браузере. Реальная БД и парсер этому режиму не нужны. После изменения переменной перезапустите Vite.
