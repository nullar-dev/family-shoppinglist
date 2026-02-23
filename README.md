# Gezins Boodschappenlijst

Een moderne, real-time familie boodschappenlijst app. Gebouwd met Next.js 14, Supabase, en Tailwind CSS.

## Features

- Real-time synchronisatie - wijzigingen zijn direct zichtbaar op alle apparaten
- PIN-gebaseerde authenticatie
- Shopping rounds (OPEN → LOCKED → REVIEW → SETTLED)
- Kostenverdeling per gebruiker of gelijk splitsen
- Geschiedenis van eerdere rondes
- Dark mode ondersteuning

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Realtime, Auth)
- **Deployment**: Vercel

## Setup

### 1. Supabase Project Aanmaken

1. Ga naar [supabase.com](https://supabase.com) en maak een gratis account
2. Maak een nieuw project aan
3. Wacht tot het project klaar is

### 2. Database Schema Instellen

1. Ga naar je Supabase dashboard
2. Klik op "SQL Editor" in het menu
3. Kopieer de inhoud van `supabase/schema.sql`
4. Plak het in de SQL editor en klik "Run"

### 3. Environment Variables

Kopieer `.env.local.example` naar `.env.local` en vul je Supabase credentials in:

```bash
NEXT_PUBLIC_SUPABASE_URL=jouw_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=jouw_anon_key
```

Haal deze op uit: Settings → API

### 4. Ontwikkelserver Draaien

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy naar Vercel

1. Push je code naar GitHub
2. Ga naar [vercel.com](https://vercel.com) en importeer het project
3. Voeg je environment variables toe in Vercel
4. Deploy!

## Gebruik

### Inloggen

Gebruik een van de standaard gebruikers:

| Naam | PIN |
|------|-----|
| Alice | 1234 |
| Bob | 2345 |
| Charlie | 3456 |
| Diana | 4567 |

### Boodschappenlijst

1. Voeg items toe met naam, hoeveelheid en optionele prijs
2. Klik "Ik ga boodschappen doen" om de lijst te vergrendelen
3. De shopper kan items markeren als "in winkelwagen" en "gekocht"
4. Na het winkelen: ga naar Kosten om te verdelen
5. Ronde afronden maakt automatisch een nieuwe open lijst aan

## Supabase Realtime Inschakelen

1. Ga naar je Supabase dashboard
2. Ga naar "Database" → "Replication"
3. Zorg dat replica publish inschakeld is voor de tabellen:
   - `rounds`
   - `items`
   - `allocations`

Of via SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE allocations;
```

## Project Structuur

```
src/
├── app/
│   ├── (app)/           # Beveiligde routes
│   │   ├── dashboard/   # Hoofd boodschappenlijst
│   │   ├── history/     # Geschiedenis
│   │   └── allocations/ # Kostenverdeling
│   ├── (auth)/          # Auth routes
│   │   └── login/       # Login pagina
│   └── layout.tsx       # Root layout
├── components/          # React componenten
├── contexts/            # React contexts
├── hooks/               # Custom hooks (realtime)
├── lib/                 # Supabase client
└── types/               # TypeScript types
```

## License

MIT - vrij voor persoonlijk familie gebruik
