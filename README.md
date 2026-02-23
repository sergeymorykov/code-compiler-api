# wandbox-clone-api

Синхронный REST API, совместимый с [Wandbox](https://wandbox.org): компиляция и запуск C++ кода в изолированных Docker-контейнерах.

## Требования

- **Node.js** 18+
- **Docker** (для запуска образов компиляторов)

## Запуск

### 1. Локально (без Docker Compose)

1. Установите зависимости и соберите проект:

   ```bash
   npm install
   npm run build
   ```

2. Соберите образы компиляторов (нужны для компиляции запросов):

   ```bash
   docker build -t wandbox-clone-api-gcc-head ./compilers/gcc
   docker build -t wandbox-clone-api-clang-head ./compilers/clang
   ```

3. Опционально создайте `.env` из примера и при необходимости измените настройки:

   ```bash
   cp .env.example .env
   ```

4. Запустите API:

   ```bash
   npm start
   ```

   Или в режиме разработки с автоперезагрузкой:

   ```bash
   npm run dev
   ```

   По умолчанию сервер слушает порт **3000**.

### 2. Через Docker Compose

Из корня репозитория:

```bash
docker compose up --build
```

Будут собраны образы компиляторов (gcc-head, clang-head) и сервис API. API будет доступен на порту **3000** (или на порту из переменной `PORT` в `.env`). Контейнер API подключается к Docker socket хоста, чтобы запускать контейнеры компиляции.

Остановка:

```bash
docker compose down
```

## Использование API

**Endpoint:** `POST /api/compile.json`

**Тело запроса (JSON):**

| Поле       | Тип     | Обязательное | Описание                                      |
|-----------|---------|--------------|-----------------------------------------------|
| `code`    | string  | да           | Исходный C++ код                              |
| `compiler`| string  | да           | `"gcc-head"` или `"clang-head"`               |
| `options` | string  | нет          | Опции компилятора через запятую, например `"warning-all,std=c++17"` |

**Ответ:** объект с **одним** из полей (формат Wandbox):

- `compiler_error` — ошибка компиляции
- `program_error` — ошибка во время выполнения программы
- `program_output` — вывод программы в stdout

**Пример запроса:**

```bash
curl -X POST http://localhost:3000/api/compile.json \
  -H "Content-Type: application/json" \
  -d '{"code":"#include <iostream>\nint main(){std::cout<<\"Hello\"<<std::endl;return 0;}","compiler":"gcc-head","options":"std=c++17"}'
```

**Пример ответа (успешный запуск):**

```json
{ "program_output": "Hello\n" }
```

Для фронтенда достаточно задать `CPP_COMPILER_URL` на этот API (например `http://localhost:3000/api/compile.json`).

## Переменные окружения

См. `.env.example`. Основные:

| Переменная               | По умолчанию | Описание                          |
|--------------------------|-------------|-----------------------------------|
| `PORT`                   | 3000        | Порт HTTP-сервера                 |
| `COMPILE_TIMEOUT_MS`     | 30000       | Таймаут компиляции (мс)           |
| `RUN_TIMEOUT_MS`         | 5000        | Таймаут выполнения программы (мс) |
| `CODE_SIZE_LIMIT_BYTES`  | 131072      | Макс. размер кода (128 KB)        |
| `CACHE_ENABLED`          | false       | Включить кэш ответов              |
| `CACHE_TTL_SECONDS`      | 60          | Время жизни записи в кэше (с)     |
| `IMAGE_GCC_HEAD`         | wandbox-clone-api-gcc-head   | Имя образа GCC   |
| `IMAGE_CLANG_HEAD`       | wandbox-clone-api-clang-head | Имя образа Clang |

## Скрипты

| Команда        | Описание                    |
|----------------|-----------------------------|
| `npm run build`| Сборка TypeScript в `dist/` |
| `npm start`    | Запуск собранного приложения |
| `npm run dev`  | Запуск с tsx и автоперезагрузкой |
| `npm run lint` | Проверка кода (ESLint)      |

## Лицензия

MIT
