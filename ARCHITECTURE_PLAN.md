# Trial Issue Log: הצעת ארכיטקטורה ותוכנית עבודה

מסמך תכנון למטלת הבית (Founding Engineer). נכתב לפני שורת הקוד הראשונה; שום שלב לא מתחיל בלי אישור.

גרסה 2: עודכנה לפי סבב הערות (pagination, סדר routes, `updated_at`, escaping בחיפוש, ייבוא CSV, היגיינה, זמן). שתי ההחלטות שהיו פתוחות הוכרעו: JavaScript ו-PostgreSQL (ראו "החלטות שהוכרעו" בסוף).

## ההמלצה בקצרה

Monorepo אחד: שרת Express על Node.js LTS, PostgreSQL, פרונט React עם Vite, והכול נארז ל-Docker image אחד שרץ על EC2.

הקו המנחה: אותו סטאק משמש גם למטלה וגם לפרודקשן, כך שהתשובה ל"מה היית עושה בפרודקשן" היא "אותו דבר, מנוהל" ולא "הייתי כותבת מחדש".

## בחירות ונימוקים

| שכבה | בחירה | למה למטלה | מה משתנה בפרודקשן |
|---|---|---|---|
| שפה | JavaScript מודרני (ESM) | כל שורה ניתנת להסבר בראיון; בלי שלב build בשרת | מעבר ל-TypeScript כשהקוד והצוות גדלים |
| שרת | Express 5 + Zod | כל בודק קורא Express מיד; סכמת Zod אחת מגדירה את הוולידציה (400) במקום אחד | השכבות (route ← service ← repository) מאפשרות מעבר ל-Fastify/NestJS כשהצוות גדל |
| DB | PostgreSQL 16 | רלציוני, `CHECK` על enums, `timestamptz`, חיפוש `ILIKE`, טרנזקציה לייבוא | RDS עם גיבויים ו-Multi-AZ; טבלאות sites/trials/users ו-audit trail (דרישה רגולטורית בתחום) |
| גישה ל-DB | `pg` עם SQL פרמטרי בלבד, בלי ORM | טבלה אחת; ORM היה over-engineering, וה-SQL עצמו הוא ה-deliverable של `db/` | Kysely לשאילתות typed וכלי migrations |
| פרונט | React + Vite + TanStack Query + React Router | החברה עובדת עם React; TanStack Query מרענן רשימה ודשבורד אחרי כל שינוי בלי state ידני | אותו סטאק, בתוספת ספריית קומפוננטות ו-auth |
| עיצוב | CSS רגיל, בלי ספריית UI | שני עמודים; פחות תלויות | design system |
| דיפלוי | image אחד (השרת מגיש גם את הפרונט) + Postgres ב-docker compose על EC2 t3.micro | origin אחד בלי CORS, פקודה אחת, בתוך ה-free tier | ECS/App Runner + RDS + CloudFront, IaC, סודות ב-Secrets Manager |
| CI | workflow מינימלי ב-GitHub Actions: התקנה ו-`npm test` | כ-15 שורות YAML, מראה deployment hygiene | מוסיפים lint ו-deploy אוטומטי |

### חלופות שנדחו

- **Next.js:** אין צורך ב-SSR, והוא מטשטש את ההפרדה בין שרת לפרונט שהמטלה מבקשת.
- **ORM (Prisma/Drizzle):** לטבלה אחת זו שכבה מיותרת; SQL גלוי קל יותר להסבר בראיון.

## מודל הנתונים

טבלת `issues` אחת:

| עמודה | טיפוס | הערות |
|---|---|---|
| `id` | identity | מפתח ראשי אוטומטי |
| `title` | text | NOT NULL |
| `description` | text | NOT NULL |
| `site` | text | NOT NULL, למשל `Site-101` |
| `severity` | text | `CHECK` על `minor` / `major` / `critical` |
| `status` | text | `CHECK` על `open` / `in_progress` / `resolved`, ברירת מחדל `open` |
| `created_at` | timestamptz | ברירת מחדל `now()` |
| `updated_at` | timestamptz | מתעדכן על ידי trigger ב-DB |

- אינדקס על `created_at DESC` (המיון של הרשימה).
- `CHECK` על text ולא enum של Postgres, כי קל יותר להוסיף ערכים בעתיד.
- **`updated_at` מתעדכן ב-trigger (`BEFORE UPDATE`) ולא בשאילתה.** עדכון ידני קל לשכוח בשאילתה חדשה; trigger תופס כל נתיב עדכון, כולל תיקון ידני ב-SQL. טסט מוודא ש-`PATCH` מקדם את `updatedAt` ולא נוגע ב-`createdAt`.

## API

| Endpoint | תפקיד |
|---|---|
| `GET /api/issues?search=&status=&severity=` | רשימה עם סינון, ממוינת לפי `createdAt` יורד |
| `GET /api/issues/stats` | ספירות לדשבורד, מחושבות ב-DB עם `GROUP BY` |
| `GET /api/issues/:id` | פרטי issue |
| `POST /api/issues` | יצירה |
| `PATCH /api/issues/:id` | עריכה חלקית; Resolve הוא `status: resolved` |
| `DELETE /api/issues/:id` | מחיקה |
| `POST /api/issues/import` | ייבוא CSV |
| `GET /health` | בדיקת חיים לדיפלוי |

- שגיאות בפורמט אחיד: `{ error: { code, message, details[] } }`.
- קלט פסול מחזיר 400; id שלא קיים מחזיר 404.
- **בלי pagination בליבה.** הפרמטר `page` הוסר כדי שה-API יתאים לתוכנית. Pagination בצד השרת (`LIMIT`/`OFFSET` + `total`) הוא שלב אופציונלי בסוף, כמו שהמטלה מגדירה ("only if time remains").
- **סדר routes:** `/stats` ו-`/import` מוגדרים לפני `/:id`, אחרת Express מפרש את "stats" כ-id. בנוסף `:id` עובר ולידציה כמספר שלם חיובי, כך ש-id לא מספרי מחזיר 400 ולא שגיאת DB. טסט ייעודי: `GET /api/issues/stats` מחזיר 200 עם מבנה הספירות.
- **חיפוש:** כל השאילתות פרמטריות (`$1`, `$2`), בלי שרשור מחרוזות. בקלט החיפוש התווים `\`, `%` ו-`_` עוברים escaping לפני `ILIKE ... ESCAPE '\'`. טסט: חיפוש `%` או `_` לא מחזיר את כל הרשומות.

### ייבוא CSV: הכול-או-כלום

- **פענוח בספרייה קיימת** (`csv-parse`), לא קוד ידני. מטפלת במירכאות, פסיקים בתוך שדה ושורות חדשות.
- **מגבלת גודל:** 1MB על גוף הבקשה; מעבר לכך 413.
- **בדיקת כותרות:** שש הכותרות (`title,description,site,severity,status,createdAt`) חייבות להופיע; כותרת חסרה מחזירה 400 לפני שמעבדים שורות.
- **כל שורה עוברת את אותה סכמת Zod** של יצירה רגילה, בתוספת `status` ו-`createdAt`.
- **טרנזקציה אחת:** אם שורה אחת פסולה, שום דבר לא נכנס וחוזר 400 עם רשימת השגיאות לפי מספר שורה. בהקשר קליני ייבוא חלקי משאיר אי-ודאות לגבי מה נכנס.
- **העלאה:** הפרונט שולח את תוכן הקובץ כגוף `text/csv`, כך שאין צורך בספריית multipart.

הנחה: ייבוא חוזר של אותו קובץ ייצור כפילויות. ייכתב ב-PRODUCT_NOTES.

## היגיינה ואבטחה בסיסית

- `.gitignore` מהקומיט הראשון: `node_modules`, `.env`, תוצרי build.
- `.env.example` עם שמות המשתנים וערכי דוגמה; ה-`.env` האמיתי לא נכנס ל-repo.
- אין סודות בקוד, ב-compose או ב-CI. סיסמת ה-DB בפרודקשן נוצרת על השרת בלבד.
- בדיפלוי Postgres לא מפרסם פורט החוצה; הוא נגיש רק ברשת הפנימית של Docker.
- ב-security group פתוחים רק 80 לכולם ו-22 מכתובת ה-IP שלי בלבד. 5432 סגור.

## מבנה תיקיות

```
trial-issue-log/
├── server/
│   ├── src/
│   │   ├── app               # בניית האפליקציה (נפרד מ-listen, בשביל טסטים)
│   │   ├── index
│   │   ├── db/               # pool + מריץ migrations
│   │   └── issues/           # routes, service, repository, schema (Zod), csv
│   └── tests/                # api/ + unit/
├── frontend/
│   └── src/
│       ├── api/              # client + hooks של TanStack Query
│       ├── pages/            # IssuesPage, DashboardPage
│       └── components/       # IssueForm, IssuesTable, Filters, ImportCsv, StatChips
├── db/                       # migrations ב-SQL (טבלה + trigger) + README של הסכמה
├── .github/workflows/ci.yml
├── .gitignore
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── issues.csv
├── README.md
├── PRODUCT_NOTES.md
└── AI_NOTES.md
```

קובצי הקוד בסיומת `.js` (ובפרונט `.jsx`).

## אסטרטגיית טסטים

רוב ההשקעה הולכת לטסטי API מול DB אמיתי (Vitest + Supertest), כי שם נמצאים הבאגים האמיתיים באפליקציית CRUD: ולידציה, שאילתות סינון וטרנזקציות.

1. **טסטי API (כ-18):**
   - ולידציה שמחזירה 400 (שדה חסר, enum לא חוקי, id לא מספרי).
   - 404 על id שלא קיים.
   - `GET /api/issues/stats` מחזיר ספירות ולא נתפס כ-`:id`.
   - ספירות ה-stats תואמות לנתונים.
   - שילובי סינון וחיפוש, וסדר המיון.
   - חיפוש עם `%` ו-`_` מתייחס אליהם כתווים רגילים.
   - `PATCH` מקדם את `updatedAt` ומשאיר את `createdAt`.
   - ייבוא: שורה פסולה לא מכניסה כלום; כותרת חסרה מחזירה 400; קובץ גדול מדי מחזיר 413.
2. **טסטי יחידה (כ-6):** פענוח ואימות ה-CSV, כולל שדה עם פסיק בתוך מירכאות ותאריך פסול; פונקציית ה-escaping של החיפוש.
3. **לא במטלה, ייכתב ב-README כ"הבא בתור" לפי הסדר:**
   1. טסטי קומפוננטה לאישור המחיקה (Delete לא מוחק בלחיצה אחת, Cancel לא מוחק, Yes, delete שולח `DELETE` ל-id הנכון). ראשון ברשימה כי מחיקה היא הפעולה היחידה שאי אפשר לבטל, וכי כאן כבר נמצא באג בבדיקה ידנית.
   2. טסט Playwright אחד לזרימה המלאה בדפדפן אמיתי.
   3. טסטי קומפוננטות לטופס ולפילטרים.
   4. טסט עומס לייבוא גדול.

פקודה אחת, `npm test`, מרימה DB לטסטים ומריצה הכול.

## תוכנית עבודה

כל שלב מסתיים במשהו שעובד מקצה לקצה, ונעצר לאישור לפני המעבר לשלב הבא.

| # | שלב | תוצר | זמן |
|---|---|---|---|
| 0 | הכנות | Node LTS ו-Docker מותקנים, `git init`, `.gitignore`, `.env.example`, שלד התיקיות | 15 דק' |
| 1 | שלד | DB ב-compose, migration (טבלה + trigger), שרת עם `/health`, טסט ראשון עובר | 30 דק' |
| 2 | יצירה ורשימה | `POST` + `GET` עם ולידציה וטסטים, ועמוד פרונט שמציג ויוצר | 50 דק' |
| 3 | עריכה, Resolve, מחיקה | `PATCH`/`DELETE`/`GET :id` עם טסטים וכפתורים בטבלה | 35 דק' |
| 4 | סינון וחיפוש | פרמטרים בשרת עם escaping וטסטים, פילטרים בפרונט (נשמרים ב-URL) | 25 דק' |
| 5 | דשבורד | `stats` עם טסטים (כולל סדר ה-routes), עמוד דשבורד וניווט | 25 דק' |
| 6 | ייבוא CSV | endpoint עם טסטים, כפתור העלאה, `issues.csv` | 35 דק' |
| 7 | אריזה | Dockerfile, README מלא, CI מינימלי | 25 דק' |
| 8 | מסמכים | PRODUCT_NOTES, AI_NOTES | 30 דק' |
| 9 | AWS (אופציונלי) | EC2 + compose, כתובת עובדת; אם אין זמן, תיעוד התהליך ב-README בלבד | 40 דק' |
| 10 | Pagination (אופציונלי) | `page`/`pageSize` + `total` בשרת, הקודם/הבא בפרונט | 20 דק' |

- ליבה (שלבים 0 עד 8): כארבע וחצי שעות, בתוך התקציב של 3 עד 5 שעות.
- עם AWS: כחמש שעות ועשר דקות. המטלה מרשה לוותר עליו ולתעד במקום.
- שלב המסמכים הוקדם לפני AWS, כי הוא חובה ו-AWS לא.

## החלטות שהוכרעו

### 1. TypeScript או JavaScript

הוחלט: **JavaScript**.

- **מה TypeScript נותן כאן בפועל:** שגיאה בזמן כתיבה כשהפרונט מצפה לשדה שהשרת לא מחזיר, והשלמה אוטומטית בעורך. באפליקציה עם טבלה אחת, ולידציית Zod בזמן ריצה וכ-18 טסטי API, רוב הבאגים האלה נתפסים בכל מקרה.
- **המחיר:** שני קובצי `tsconfig`, שלב build לשרת, והגדרות טיפוסים (generics של Express ושל TanStack Query) שצריך לדעת להסביר שורה-שורה בראיון.
- **השיקול המכריע:** הקריטריון הראשון בהערכה הוא "the ability to explain what you have". קוד JavaScript שמוסבר בביטחון עדיף על TypeScript שמוסבר בהיסוס.
- **מה כותבים ב-README:** שבפרודקשן, עם צוות וקוד גדלים, עוברים ל-TypeScript, ולמה לא עכשיו.

### 2. Postgres + Docker או SQLite

הוחלט: **Postgres**, בתנאי ש-Docker עולה על המחשב בשלב 0 בתוך כרבע שעה. אם לא, עוברים ל-SQLite.

- **בעד Postgres:** אותו DB במטלה ובפרודקשן; הטסטים בודקים את ה-`ILIKE`, ה-trigger וה-`timestamptz` האמיתיים; הדיפלוי ל-EC2 זהה להרצה המקומית.
- **בעד SQLite:** הבודק מריץ `npm install` ו-`npm start` בלי Docker; חוסך כ-20 עד 30 דקות; המטלה שואלת בנפרד על המטלה ועל פרודקשן, כך ש"SQLite עכשיו, Postgres בפרודקשן" היא תשובה לגיטימית.
- **איך מקטינים את המחיר של Postgres לבודק:** ה-README נפתח בפקודה אחת, `docker compose up`, שמרימה DB, migrations ואפליקציה בלי להתקין Node. אחריה מסלול פיתוח נפרד (DB ב-Docker, שרת ופרונט עם `npm run dev`), ודרישות קדם מפורשות בראש המסמך. כתובת ה-AWS, אם תהיה, מאפשרת לנסות בלי להריץ כלום.

## שאלות פתוחות נוספות

- **Node ו-Docker:** נבדק בשלב 0, שניהם לא מותקנים במחשב (גם לא Homebrew). צריך להתקין לפני שלב 1.
- **חשבון AWS:** האם קיים? בחשבונות שנפתחו אחרי יולי 2025 ה-free tier הוא קרדיטים ולא 12 חודשים; t3.micro מכוסה בשני המקרים.
- **AI_NOTES:** צריך לשקף את מה שקרה באמת (איפה ה-AI טעה, מה נדחה). אפשר לצרף `/export` של השיחה במקום.
