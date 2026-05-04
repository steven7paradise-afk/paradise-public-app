import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import "../styles/paradise-design.css";

const storeAdminUrl = "https://admin.shopify.com/store/paradisee-dev";
const themeEditorUrl =
  "https://paradisee-dev.myshopify.com/admin/themes/188041953566/editor";

const sections = [
  {
    name: "Paradise ADV Slot",
    description:
      "Banner ADV trasparente da inserire in home, collezioni, prodotti o pagine template.",
    status: "Nuovo",
  },
  {
    name: "Slider Maison",
    description: "Hero slider premium con immagini desktop/mobile, CTA, frecce, dots e autoplay.",
    status: "Pronto",
  },
  {
    name: "Photo Button",
    description: "Griglia di immagini cliccabili per collezioni, categorie e campagne.",
    status: "Pronto",
  },
  {
    name: "Lookbook Editoriale",
    description: "Layout editoriale per immagini magazine, collage e visual storytelling.",
    status: "In arrivo",
  },
  {
    name: "Before After Luxury",
    description: "Comparatore prima/dopo con slider trascinabile.",
    status: "In arrivo",
  },
];

const advSlots = [
  {
    code: "home-adv-1",
    placement: "Homepage",
    note: "Banner editoriale tra hero, collezioni o prodotti in evidenza.",
  },
  {
    code: "collection-adv-1",
    placement: "Collezione",
    note: "ADV stile Rhode da posizionare dentro o tra sezioni della collezione.",
  },
  {
    code: "product-adv-1",
    placement: "Prodotto",
    note: "Cross-sell visuale, lancio prodotto o campagna beauty.",
  },
];

const advControlGroups = [
  {
    title: "Sorgente",
    controls: [
      "Mostra ADV",
      "Codice slot",
      "Usa campagna globale dall'app",
      "Usa campagna della collezione corrente",
    ],
  },
  {
    title: "Media",
    controls: [
      "Immagine desktop",
      "Immagine mobile",
      "Testo accessibilita immagine",
      "Link banner",
    ],
  },
  {
    title: "Testi",
    controls: ["Sopratitolo", "Titolo", "Descrizione", "Testo bottone"],
  },
  {
    title: "Layout",
    controls: [
      "Posizione testo",
      "Altezza desktop",
      "Altezza mobile",
      "Posizione immagine desktop",
      "Posizione immagine mobile",
      "Trasparenza overlay",
      "Angoli immagine",
      "Larghezza massima testo",
    ],
  },
  {
    title: "Colori e CTA",
    controls: [
      "Colore testo",
      "Sfondo bottone",
      "Trasparenza sfondo bottone",
      "Testo bottone",
      "Bordo bottone",
      "Sfondo bottone hover",
      "Testo bottone hover",
      "Angoli bottone",
    ],
  },
  {
    title: "Spaziatura",
    controls: [
      "Spazio sopra desktop",
      "Spazio sotto desktop",
      "Spazio sopra mobile",
      "Spazio sotto mobile",
    ],
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <main className="pd-home" aria-label="Paradise Design home">
      <section className="pd-home-hero">
        <div>
          <span className="pd-home-kicker">Paradise Design</span>
          <h1>Crea banner e sezioni luxury direttamente nel Theme Editor.</h1>
          <p>
            Non devi incollare codice nel tema. Aggiungi le sezioni Paradise dal
            pannello Shopify, compila immagini e testi, poi salvi il tema.
          </p>
          <div className="pd-home-actions">
            <a className="pd-home-button" href="/app/campaigns">
              Apri Campagne ADV
            </a>
            <a className="pd-home-button" href={themeEditorUrl} target="_blank" rel="noreferrer">
              Apri Theme Editor
            </a>
            <a className="pd-home-button pd-home-button--secondary" href={storeAdminUrl} target="_blank" rel="noreferrer">
              Apri admin store
            </a>
          </div>
        </div>
        <div className="pd-home-checklist" aria-label="Come attivare un banner">
          <h2>Come attivare un banner</h2>
          <ol>
            <li>Apri il Theme Editor.</li>
            <li>Clicca Aggiungi sezione.</li>
            <li>Apri la categoria Apps.</li>
            <li>Scegli Paradise ADV Slot, Slider Maison o Photo Button.</li>
            <li>Carica immagini, testi, link e salva.</li>
          </ol>
        </div>
      </section>

      <section className="pd-home-panel" aria-label="ADV Manager">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">ADV Manager</span>
          <h2>Slot banner per template e collezioni</h2>
          <p>
            Crea uno spazio ADV dove vuoi nel tema. In editor vedrai il
            placeholder se e&apos; vuoto; nel sito pubblico resta invisibile finche&apos;
            non carichi un&apos;immagine.
          </p>
        </div>
        <div className="pd-home-adv-grid">
          {advSlots.map((slot) => (
            <a className="pd-home-adv-card" href={themeEditorUrl} target="_blank" rel="noreferrer" key={slot.code}>
              <span>{slot.placement}</span>
              <h3>{slot.code}</h3>
              <p>{slot.note}</p>
              <strong>Apri Theme Editor</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="pd-home-panel" aria-label="Controlli Paradise ADV Slot">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">Paradise ADV Slot</span>
          <h2>Controlli disponibili nel Theme Editor</h2>
          <p>
            Questa e&apos; la mappa completa dei campi del blocco. Le immagini,
            altezze, colori e spaziature si regolano nel Theme Editor; la
            campagna globale gestisce testi, immagini, date e posizione testo
            quando vuoi aggiornare piu&apos; slot insieme.
          </p>
        </div>
        <div className="pd-control-grid">
          {advControlGroups.map((group) => (
            <article className="pd-control-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.controls.map((control) => (
                  <li key={control}>{control}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="pd-home-panel" aria-label="Sezioni disponibili">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">Theme App Extension</span>
          <h2>Sezioni disponibili</h2>
        </div>
        <div className="pd-home-sections">
          {sections.map((section) => (
            <article className="pd-home-section" key={section.name}>
              <div>
                <h3>{section.name}</h3>
                <p>{section.description}</p>
              </div>
              <span>{section.status}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="pd-home-guide" aria-label="Nota sul codice">
        <h2>Dove metto il codice?</h2>
        <p>
          In questa app non serve mettere codice manuale. Il banner si attiva
          quando aggiungi la sezione Paradise nel Theme Editor. Questa e&apos; la
          soluzione migliore per Shopify perche&apos; resta modificabile, sicura e
          compatibile con desktop e mobile.
        </p>
        <p>
          Per la tua idea ADV: aggiungi <strong>Paradise ADV Slot</strong> nel
          template desiderato, scrivi il codice slot, carica immagine desktop e
          mobile, poi collega il CTA. Puoi ripetere lo stesso blocco in home,
          collezioni, prodotti o pagine custom.
        </p>
        <p>
          Gli slot nella schermata app servono come guida rapida. La modifica
          vera delle immagini ADV avviene nel pannello a destra del Theme
          Editor, come nello screenshot che hai mandato.
        </p>
      </section>
    </main>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
