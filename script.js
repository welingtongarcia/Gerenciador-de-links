const biblioteca = document.getElementById("biblioteca");
const pesquisa = document.getElementById("pesquisa");
const legenda = document.getElementById("legenda");
const modoVisualizacao = document.getElementById("modoVisualizacao");
const ordemItens = document.getElementById("ordemItens");

let mangas = [];
let ocultosLiberados = false;
let modoAtual = "cards";
let ordemAtual = "alfabetica";

fetch("links.txt")
  .then(response => {
    if (!response.ok) {
      throw new Error("Arquivo links.txt não encontrado");
    }

    return response.text();
  })
  .then(texto => {
    mangas = texto
      .split(/\r?\n/)
      .map(linha => linha.trim())
      .filter(linha => linha !== "")
      .filter(linha => !linha.startsWith("#"))
      .map(linha => converterLinhaEmLink(linha))
      .filter(item => item !== null);

    atualizarTela();
  })
  .catch(erro => {
    biblioteca.innerHTML = `
      <p class="erro">Erro ao carregar o arquivo links.txt.</p>
    `;

    console.error(erro);
  });

/*
  Formatos aceitos no links.txt:

  Grupo|Nome|Classificação|Link
  Grupo|Nome|Link
  Link

  Todos também aceitam |oculto no final:

  Grupo|Nome|Classificação|Link|oculto
  Grupo|Nome|Link|oculto
  Link|oculto

  Também corrige linhas com campo vazio acidental:
  Grupo|Nome||Medios|https://site.com|oculto
*/
function converterLinhaEmLink(linha) {
  let partes = linha
    .split("|")
    .map(parte => parte.trim());

  let oculto = false;

  // Se a linha terminar com |oculto, marca como oculto e remove esse campo
  if (partes.length > 0 && partes[partes.length - 1].toLowerCase() === "oculto") {
    oculto = true;
    partes.pop();
  }

  // Remove campos vazios acidentais, por exemplo: Nome||Medios
  partes = partes.filter(parte => parte !== "");

  // Formato: https://site.com
  if (partes.length === 1 && partes[0].startsWith("http")) {
    return {
      grupo: "Sem classificação",
      nome: partes[0],
      classificacao: "Sem classificação",
      link: partes[0],
      observacao: "",
      oculto
    };
  }

  // Formato: https://site.com|observação
  if (partes.length >= 2 && partes[0].startsWith("http")) {
    return {
      grupo: "Sem classificação",
      nome: partes[0],
      classificacao: "Sem classificação",
      link: partes[0],
      observacao: partes.slice(1).join(" - "),
      oculto
    };
  }

  // Procura o campo do link em qualquer posição
  const link = partes.find(parte => parte.startsWith("http"));

  if (!link) {
    return null;
  }

  const indiceLink = partes.indexOf(link);

  // Formato: Grupo|Nome|Link
  if (indiceLink === 2) {
    return {
      grupo: partes[0],
      nome: partes[1],
      classificacao: "Sem classificação",
      link,
      observacao: partes.slice(indiceLink + 1).join(" - "),
      oculto
    };
  }

  // Formato: Grupo|Nome|Classificação|Link
  // Formato: Grupo|Nome|Classificação|Link|Observação
  if (indiceLink >= 3) {
    return {
      grupo: partes[0],
      nome: partes[1],
      classificacao: partes[indiceLink - 1] || "Sem classificação",
      link,
      observacao: partes.slice(indiceLink + 1).join(" - "),
      oculto
    };
  }

  return null;
}

function normalizarClasse(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function obterListaBase() {
  return ocultosLiberados
    ? mangas
    : mangas.filter(manga => !manga.oculto);
}

function filtrarLista() {
  const termo = pesquisa.value.toLowerCase().trim();
  const listaBase = obterListaBase();

  if (termo === "") {
    return listaBase;
  }

  return listaBase.filter(manga =>
    manga.nome.toLowerCase().includes(termo) ||
    manga.grupo.toLowerCase().includes(termo) ||
    manga.classificacao.toLowerCase().includes(termo) ||
    (manga.observacao && manga.observacao.toLowerCase().includes(termo))
  );
}

function atualizarTela() {
  const lista = filtrarLista();
  gerarLegenda(lista);
  mostrarBiblioteca(lista);
}

function gerarLegenda(lista) {
  const classificacoes = [
    ...new Set(lista.map(manga => manga.classificacao))
  ];

  legenda.innerHTML = `<h2>Legenda das classificações</h2>`;

  if (classificacoes.length === 0) {
    legenda.innerHTML += `<p>Nenhuma classificação encontrada.</p>`;
    return;
  }

  classificacoes.forEach(classificacao => {
    const classe = normalizarClasse(classificacao);

    legenda.innerHTML += `
      <span class="item-legenda ${classe}">
        ${classificacao}
      </span>
    `;
  });
}


function obterPesoClassificacao(classificacao) {
  const classe = normalizarClasse(classificacao);

  const pesos = {
    "muito-bons": 1,
    "bons": 2,
    "medios": 3,
    "ruins": 4,
    "sem-classificacao": 5
  };

  return pesos[classe] || 99;
}

function agruparPorGrupo(lista) {
  const grupos = {};

  lista.forEach(manga => {
    if (!grupos[manga.grupo]) {
      grupos[manga.grupo] = [];
    }

    grupos[manga.grupo].push(manga);
  });

  for (const grupo in grupos) {
    grupos[grupo].sort((a, b) => {
      if (ordemAtual === "classificacao") {
        const pesoA = obterPesoClassificacao(a.classificacao);
        const pesoB = obterPesoClassificacao(b.classificacao);

        if (pesoA !== pesoB) {
          return pesoA - pesoB;
        }
      }

      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }

  return grupos;
}

function mostrarBiblioteca(lista) {
  biblioteca.innerHTML = "";

  if (lista.length === 0) {
    biblioteca.innerHTML = "<p>Nenhum link encontrado.</p>";
    return;
  }

  const grupos = agruparPorGrupo(lista);

  for (const nomeGrupo in grupos) {
    const secaoGrupo = document.createElement("section");
    secaoGrupo.classList.add("grupo");

    let html = `<h2>${nomeGrupo}</h2>`;

    if (modoAtual === "cards") {
      html += `<div class="cards">`;

      grupos[nomeGrupo].forEach(manga => {
        const classe = normalizarClasse(manga.classificacao);

        html += `
          <article class="card ${classe}">
            <span class="classificacao">${manga.classificacao}</span>
            <h3>${manga.nome}</h3>
            ${manga.observacao ? `<p class="observacao">${manga.observacao}</p>` : ""}
            <a href="${manga.link}" target="_blank">Abrir Link</a>
          </article>
        `;
      });

      html += `</div>`;
    }

    if (modoAtual === "lista") {
      html += `<div class="lista-links">`;

      grupos[nomeGrupo].forEach(manga => {
        const classe = normalizarClasse(manga.classificacao);

        html += `
          <div class="item-lista ${classe}">
            <div class="info-lista">
              <strong>${manga.nome}</strong>
              <span>${manga.classificacao}</span>
              ${manga.observacao ? `<p class="observacao-lista">${manga.observacao}</p>` : ""}
            </div>
            <a href="${manga.link}" target="_blank">Abrir</a>
          </div>
        `;
      });

      html += `</div>`;
    }

    secaoGrupo.innerHTML = html;
    biblioteca.appendChild(secaoGrupo);
  }
}

pesquisa.addEventListener("input", () => {
  const termo = pesquisa.value.toLowerCase().trim();

  if (termo === "oculto" && !ocultosLiberados) {
    const senha = prompt("Digite a senha para mostrar os links ocultos:");

    if (senha === "oculto") {
      ocultosLiberados = true;
      alert("Links ocultos liberados.");
      pesquisa.value = "";
      atualizarTela();
      return;
    }

    alert("Senha incorreta.");
    pesquisa.value = "";
    atualizarTela();
    return;
  }

  if (termo === "block") {
    ocultosLiberados = false;
    alert("Links ocultos bloqueados novamente.");
    pesquisa.value = "";
    atualizarTela();
    return;
  }

  atualizarTela();
});

modoVisualizacao.addEventListener("change", () => {
  modoAtual = modoVisualizacao.value;
  atualizarTela();
});


ordemItens.addEventListener("change", () => {
  ordemAtual = ordemItens.value;
  atualizarTela();
});
