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
  Grupo|Nome|Classificação|Link|Observação
  Grupo|Nome|Link
  Link

  Linhas ocultas podem ficar totalmente codificadas no formato:

  ENC|TEXTO_EM_BASE64

  Ao decodificar, o conteúdo interno precisa terminar com |oculto.
  Exemplo interno antes da codificação:
  Grupo|Nome|Classificação|Link|Observação|oculto

  Observação: Base64 não é criptografia forte; é apenas codificação para
  não deixar os dados legíveis diretamente no arquivo links.txt.
*/
function converterLinhaEmLink(linha) {
  // Linhas que começam com ENC| estão inteiras codificadas em Base64.
  // Isso esconde grupo, nome, classificação, link e observação no arquivo TXT.
  if (linha.startsWith("ENC|")) {
    const conteudoCodificado = linha.substring(4).trim();
    const linhaDecodificada = decodificarBase64(conteudoCodificado);

    if (!linhaDecodificada) {
      return null;
    }

    linha = linhaDecodificada.trim();
  }

  let partes = linha
    .split("|")
    .map(parte => parte.trim());

  let oculto = false;

  if (partes.length > 0 && partes[partes.length - 1].toLowerCase() === "oculto") {
    oculto = true;
    partes.pop();
  }

  // Remove campos vazios acidentais, por exemplo: Nome||Medios
  partes = partes.filter(parte => parte !== "");

  if (partes.length === 0) {
    return null;
  }

  // Formato: Link puro
  if (partes.length === 1) {
    const linkFinal = obterLinkFinal(partes[0], oculto);

    if (!linkFinal) {
      return null;
    }

    return {
      grupo: "Sem classificação",
      nome: linkFinal,
      classificacao: "Sem classificação",
      link: linkFinal,
      observacao: "",
      oculto
    };
  }

  // Formato: Grupo|Nome|Link
  if (partes.length === 3) {
    const linkFinal = obterLinkFinal(partes[2], oculto);

    if (!linkFinal) {
      return null;
    }

    return {
      grupo: partes[0],
      nome: partes[1],
      classificacao: "Sem classificação",
      link: linkFinal,
      observacao: "",
      oculto
    };
  }

  // Formato: Grupo|Nome|Classificação|Link
  // Formato: Grupo|Nome|Classificação|Link|Observação
  if (partes.length >= 4) {
    const linkFinal = obterLinkFinal(partes[3], oculto);

    if (!linkFinal) {
      return null;
    }

    return {
      grupo: partes[0],
      nome: partes[1],
      classificacao: partes[2] || "Sem classificação",
      link: linkFinal,
      observacao: partes.slice(4).join(" - "),
      oculto
    };
  }

  return null;
}

function obterLinkFinal(valor, oculto) {
  if (!valor) {
    return "";
  }

  if (valor.startsWith("http")) {
    return valor;
  }

  // Compatibilidade com versões antigas: caso exista link oculto antigo
  // em que apenas o link foi codificado em Base64.
  if (oculto) {
    const linkDecodificado = decodificarBase64(valor);

    if (linkDecodificado && linkDecodificado.startsWith("http")) {
      return linkDecodificado;
    }
  }

  return "";
}

function decodificarBase64(texto) {
  try {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(texto), caractere => {
          return "%" + ("00" + caractere.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
  } catch (erro) {
    console.warn("Não foi possível decodificar uma linha oculta:", texto);
    return "";
  }
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
