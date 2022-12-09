import { query as muQuery, update as muUpdate, sparqlEscapeUri } from 'mu';

const BATCH_SIZE = 100;
const MAX_RETRIES = 5;
const RETRY_TIMEOUT = 10000;

async function query(theQuery, retryCount = 0) {
  try {
    return await muQuery(theQuery);
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryCount * RETRY_TIMEOUT)
      );
      console.debug("Retrying query...")
      return await update(theQuery, retryCount + 1);
    }
    throw e;
  }
}

async function update(theQuery, retryCount = 0) {
  try {
    return await muUpdate(theQuery);
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryCount * RETRY_TIMEOUT)
      );
      return await update(theQuery, retryCount + 1);
    }
    throw e;
  }
}

async function fetchNieuwsberichten() {
  const response = await query(`
PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
PREFIX dbpedia: <http://dbpedia.org/ontology/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?nieuwsbericht
WHERE {
  GRAPH ?g {
    ?nieuwsbericht a besluitvorming:NieuwsbriefInfo .
  }
}
LIMIT ${BATCH_SIZE}
`);
  if (response.results.bindings.length) {
    return response.results.bindings.map((binding) => binding.nieuwsbericht.value);
  }
  return [];
}

async function migrateNieuwsberichten(uris) {
  const theQuery = `
PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
PREFIX dbpedia: <http://dbpedia.org/ontology/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

DELETE {
  GRAPH ?g {
    ?nieuwsbericht a besluitvorming:NieuwsbriefInfo .
    ?nieuwsbericht dbpedia:subtitle ?subtitle .
    ?nieuwsbericht ext:htmlInhoud ?htmlContent .
    ?nieuwsbericht besluitvorming:inhoud ?plainText .
    ?nieuwsbericht ext:opmerking ?remark .
    ?nieuwsbericht ext:aangepastOp ?modified .
    ?agendaItemTreatment prov:generated ?nieuwsbericht .
    ?nieuwsbericht ext:documentenVoorPublicatie ?attachments .
  }
}
INSERT {
  GRAPH ?g {
    ?nieuwsbericht a ext:Nieuwsbericht .
    ?nieuwsbericht dct:alternative ?subtitle .
    ?nieuwsbericht nie:htmlContent ?htmlContent .
    ?nieuwsbericht prov:value ?plainText .
    ?nieuwsbericht rdfs:comment ?remark .
    ?nieuwsbericht dct:modified ?modified .
    ?agendaItemTreatment prov:wasDerivedFrom ?nieuwsbericht .
    ?nieuwsbericht besluitvorming:heeftBijlage ?attachments .
  }
}
WHERE {
  GRAPH ?g {
    VALUES (?nieuwsbericht) { ${uris.map((uri) => '(' + sparqlEscapeUri(uri) + ')').join('\n')} }
    ?nieuwsbericht a besluitvorming:NieuwsbriefInfo .
    OPTIONAL { ?nieuwsbericht dbpedia:subtitle ?subtitle }
    OPTIONAL { ?nieuwsbericht ext:htmlInhoud ?htmlContent }
    OPTIONAL { ?nieuwsbericht besluitvorming:inhoud ?plainText }
    OPTIONAL { ?nieuwsbericht ext:opmerking ?remark }
    OPTIONAL { ?nieuwsbericht ext:aangepastOp ?modified }
    OPTIONAL { ?nieuwsbericht ^prov:generated ?agendaItemTreatment }
    OPTIONAL { ?nieuwsbericht ext:documentenVoorPublicatie ?attachments }
  }
}
`;
  await update(theQuery);
}

(async function () {
  let uris;
  while ((uris = await fetchNieuwsberichten()).length) {
    console.log('--------------------');
    console.log(`Fetched ${uris.length} news item URIs. Starting migrating...`);
    await migrateNieuwsberichten(uris);
    console.log(`Migrated ${uris.length} news items to new model.`);
    console.log('--------------------');
  }
  console.log('Finished migrating news items');
})();
