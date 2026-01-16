import type { ImplicitArrayBuffer } from "node:buffer";

import { Jimp } from "jimp";

/**
 * Function to estimate the contrast of an image based on the dominant colors
 * returned by the Google Cloud Vision API's IMAGE_PROPERTIES feature.
 *
 * @param {Array} dominantColors - The array of dominant color objects from Vision API.
 * @returns {number} The estimated contrast value, normalized to a 0.0 to 1.0 range.
 */
function inferAndNormalizeContrast(dominantColors: any) {
  if (!dominantColors || dominantColors.length === 0) {
    return 0.0; // No colors to calculate contrast
  }

  let minLuminance = Infinity;
  let maxLuminance = -Infinity;

  // Luminance formula (sRGB Luma): 0.2126*R + 0.7152*G + 0.0722*B
  const calculateLuminance = (r: number, g: number, b: number): number => {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // 1. Find the min and max luminance among all dominant colors
  for (const colorAnnotation of dominantColors) {
    const color = colorAnnotation.color || {};
    const r = color.red || 0;
    const g = color.green || 0;
    const b = color.blue || 0;

    const currentLuminance = calculateLuminance(r, g, b);

    if (currentLuminance < minLuminance) {
      minLuminance = currentLuminance;
    }
    if (currentLuminance > maxLuminance) {
      maxLuminance = currentLuminance;
    }
  }

  // 2. Calculate the raw contrast score (0 to 255)
  const rawContrast = maxLuminance - minLuminance;

  // 3. Normalize the score to the 0.0 to 1.0 range
  const MAX_RAW_CONTRAST = 255.0;
  const normalizedContrast = rawContrast / MAX_RAW_CONTRAST;

  // Ensure the value is capped at 1.0
  return Math.min(1.0, Math.max(0.0, normalizedContrast));
}

export async function processarImagemParaVisionAI(
  dadosDoFicheiro: Buffer,
  originalImageProperties: unknown,
) {
  try {
    const image = await Jimp.read(dadosDoFicheiro);

    // 1. Extração do Brilho Ponderado da Imagem Original
    const dominantColors =
      // @ts-ignore
      originalImageProperties?.[0]?.imagePropertiesAnnotation?.dominantColors
        ?.colors;

    let brilhoMedioOriginal = 0;

    if (dominantColors && dominantColors.length > 0) {
      const corPrincipal = dominantColors[0].color;
      const r = corPrincipal.red || 0;
      const g = corPrincipal.green || 0;
      const b = corPrincipal.blue || 0;

      // Brilho Ponderado da Cor Dominante (0-255)
      brilhoMedioOriginal = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    // Contraste Inferido (normalizado 0.0-1.0)
    const inferedContrast = inferAndNormalizeContrast(dominantColors);

    // 2. CÁLCULO ADAPTATIVO DOS PARÂMETROS JIMPS
    // Substituímos os IF/ELSE pela lógica de fórmula.

    // Normaliza o brilho médio da cor principal para um valor entre 0 e 1
    const normalizedBrilho = brilhoMedioOriginal / 255.0;

    // A. Ajuste de Brilho (brilhoAjuste)
    // Jimp aceita -1.0 a 1.0. Queremos: Alto ajuste para imagens escuras (brilho baixo).
    // FÓRMULA: 0.8 (deslocamento base) - (Brilho Normalizado * 1.5 - fator de escala)
    let brilhoAjuste = 1.75 + 0.8 - normalizedBrilho * 1.25;
    brilhoAjuste = Math.min(1.5, Math.max(-1.0, brilhoAjuste)); // Limita ao range Jimp (-1.0 a 1.0)

    // B. Ajuste de Contraste (contrasteAjuste)
    // Jimp aceita -1.0 a 1.0. Queremos: Alto ajuste para imagens de baixo contraste.
    // FÓRMULA: 0.8 (deslocamento base) - Contraste Inferido
    // Nota: Um contraste inferido de 0.9 resulta em 0.8 - 0.9 = -0.1 (pequena redução)
    let contrasteAjuste = 0.5 - inferedContrast;
    contrasteAjuste = Math.min(1.0, Math.max(-1.0, contrasteAjuste)); // Limita ao range Jimp

    // C. Valor de Threshold (thresholdValue)
    // Mantido alto para forçar o fundo a ser branco.
    // FÓRMULA: 250 (base) + (Brilho Normalizado * 5 - pequena variação)
    let thresholdValue = 250 + normalizedBrilho * 5;
    thresholdValue = Math.min(255, Math.floor(thresholdValue));

    console.log(`\n--- AJUSTES ADAPTATIVOS ---`);
    console.log(`Brilho Médio (0-255): ${brilhoMedioOriginal.toFixed(0)}`);
    console.log(`Contraste Inferido (0.0-1.0): ${inferedContrast.toFixed(2)}`);
    console.log(`-> Brilho Ajuste (Jimp): ${brilhoAjuste.toFixed(3)}`);
    console.log(`-> Contraste Ajuste (Jimp): ${contrasteAjuste.toFixed(3)}`);
    console.log(`-> Threshold Final: ${thresholdValue}`);

    // 3. Aplicação dos Ajustes (UNIFICADO)
    // @ts-ignore
    image
      .greyscale()
      // @ts-ignore
      .brightness(brilhoAjuste)
      .contrast(contrasteAjuste)
      // @ts-ignore
      .threshold({ max: 255, min: thresholdValue });

    const buffer = await image.getBuffer("image/jpeg");
    const imagemBase64 = buffer.toString("base64");

    return imagemBase64;
  } catch (error) {
    console.error("Erro no processamento da imagem:", error);
    return null;
  }
}

// -------------------------------------------------------------------------
// FUNÇÕES DE PROCESSAMENTO DE TEXTO (MANTIDAS INALTERADAS)
// -------------------------------------------------------------------------

export function processarVersoCCidOrPassport(text: string | null | undefined) {
  const dadosVerso = {
    tipoDocumento: "Cartão de Cidadão (Verso)",
    nif: null,
  };

  if (!text) {
    return dadosVerso;
  }

  const nifMatch = text.match(/(\d{9})/);

  if (nifMatch) {
    // @ts-ignore
    dadosVerso.nif = nifMatch[1];
  }

  return dadosVerso;
}

export function processarCCidOrPassport(text: string | null | undefined) {
  const dadosCC = {
    tipoDocumento: "Cartão de Cidadão",
    apelidos: null as string | null,
    nomeProprio: null as string | null,
    nacionalidade: null as string | null,
    sexo: null as string | null,
    altura: null as string | null,
    dataNascimento: null as string | null,
    dataValidade: null as string | null,
    nDocumento: null as string | null,
    nCivilID: null as string | null,
  };

  if (!text) {
    return dadosCC;
  }

  // 1. APELIDOS
  const apelidosMatch = text.match(/APELIDO\(S\)\s*SURNAME\s*([^\n]+)/i);
  if (apelidosMatch) {
    dadosCC.apelidos = apelidosMatch[1].trim();
  }

  // 2. NOME PRÓPRIO (CORREÇÃO DE DESALINHAMENTO)
  const nomeBlockMatch = text.match(
    // Captura o bloco entre 'GIVEN NAME' e a próxima grande etiqueta
    /GIVEN\s*NAME\s*([\s\S]*?)(?:REPÚBLICA|SEXO|SEND|N° DOCUMENTO|NOMES)/i,
  );

  if (nomeBlockMatch) {
    const blocoTexto = nomeBlockMatch[1];

    // 1. Remove ruído (PORTUGAL, REPÚBLICA) e normaliza quebras de linha
    let nomeLimpo = blocoTexto
      .replace(/PORTUGAL|REPÚBLICA\s*PORTUGUESA\s*PORTUGUESE\s*REPUBLIC/gi, "")
      .replace(/\n/g, " ")
      .trim();

    // 2. Captura a última palavra em MAIÚSCULAS no bloco limpo (LEONEL ou RENATO)
    const nomeMatch = nomeLimpo.match(/([A-Z]+)\s*$/);

    if (nomeMatch && nomeMatch[1].length > 1) {
      dadosCC.nomeProprio = nomeMatch[1];
    }
  }

  // 3. SEXO, ALTURA e NACIONALIDADE
  const blocoNacionalidadeMatch = text.match(
    /SEX\s*HEIGHT\s*NATIONALITY\s*([M|F])\s*([\d,.]+)\s*([A-Z]{3})/,
  );
  if (blocoNacionalidadeMatch) {
    dadosCC.sexo = blocoNacionalidadeMatch[1].trim();
    dadosCC.altura = blocoNacionalidadeMatch[2].trim();
    dadosCC.nacionalidade = blocoNacionalidadeMatch[3].trim();
  }

  // 4. DATA DE NASCIMENTO
  const dataNascimentoMatch = text.match(
    /DATE OF BIRTH\s*(\d{2}\s*\d{2}\s*\d{4})/,
  );
  if (dataNascimentoMatch) {
    dadosCC.dataNascimento = dataNascimentoMatch[1].trim().replace(/\s/g, "-");
  }

  // 5. DATA DE VALIDADE
  const dataValidadeMatch = text.match(
    // Adicionada 'DATA CE VALIDADE' para maior robustez
    /(?:DATA DE VALIDADE|DATA CE VALIDADE|EXPIRY DATE)\s*[A-Z0-9\s]*(\d{2}\s*\d{2}\s*\d{4})/i,
  );
  if (dataValidadeMatch) {
    // A data é sempre o último grupo de captura
    dadosCC.dataValidade = dataValidadeMatch[1].trim().replace(/\s/g, "-");
  }

  // 6. N.º DOCUMENTO e N.º ID CIVIL (CORRIGIDO)
  const nDocsBlockMatch = text.match(
    // Uso de (?: ) e DATA CE VALIDADE para robustez
    /N° DOCUMENTO\s*DOCUMENT\s*No\.\s*([\s\S]*?)(?:DATA DE VALIDADE|DATA CE VALIDADE|EXPIRY DATE)/i,
  );

  if (nDocsBlockMatch) {
    const docBlock = nDocsBlockMatch[1];

    // a) N.º Documento (8 dígitos)
    const nDocumentoMatch = docBlock.match(/([0-9]{8})/);
    if (nDocumentoMatch) {
      dadosCC.nDocumento = nDocumentoMatch[1];
    }

    // b) N.º ID Civil (Sequência Alfanumérica)
    const nCivilIDMatch = docBlock.match(
      /ID\s*CIVILI?\s*CIVIL\s*ID\s*No\.\s*([A-Z0-9]+)/i,
    );
    if (nCivilIDMatch) {
      dadosCC.nCivilID = nCivilIDMatch[1];
    } else {
      // Fallback: Procura a sequência que combine letras e números (como 1ZV5 ou 9ZX8)
      const fallbackIDMatch = docBlock.match(/([A-Z]+[0-9]+|[0-9]+[A-Z]+)/);
      if (fallbackIDMatch) {
        dadosCC.nCivilID = fallbackIDMatch[1];
      }
    }
  }

  return dadosCC;
}

export function processarCartaConducaoFrente(text: string) {
  const dados = {
    tipoDocumento: "Carta de Condução (Frente)",
    nome: null,
    dataNascimento: null,
    numeroCarta: null,
    dataEmissao: null,
    dataValidade: null,
    categorias: undefined,
  };

  let campo1Nome = null;
  let campo2Apelido = null;

  // 1. Capturar o texto do campo 1. (Nome Próprio/Campo de Nome)
  const match1 = text.match(/1\.\s*([\s\S]+?)2\.\s*/);
  if (match1 && match1[1]) {
    campo1Nome = match1[1]
      .trim()
      .replace(/[^a-zA-Z\s]/g, "")
      .trim();
  }

  // 2. Capturar o texto do campo 2. (Apelido/Nome do Meio e Último)
  const match2 = text.match(/2\.\s*([\s\S]+?)3\.\s*\d{2}/);
  if (match2 && match2[1]) {
    let apelidoBruto = match2[1];

    // 2a. Limpeza Agresiva de RUÍDO
    apelidoBruto = apelidoBruto.replace(
      /CARTA DE CONDUÇÃO|REPÚBLICA PORTUGUESA|CONDUÇÃO CART|NDUCERE|EUKAZ VODIČSKY PR|NISKO DOVOLJENJE|ORTTIAJOKORTTIA|MORT KORK|ROPEIA|RT KO|E DRIVING LICENCE OF VING LICENCE DRIVING LICE|S DE CONDUIRE PERMIS DE CONDUIRE PERMIS OF C|ACEADUNAS TIOMANA CLADUNAS TIO|PATENTE DI GUIDA PATENTE DI|APLIECĪBA VALITAJA APLIE|TOTOJO PAŽYMĖJIMAS VAIRUOTOJO|ENGEDÉLY VĚZETŐLENGEDÉLY VEZETŐLENGE OF LEZE|LICENZJAYAS SE WOAK LICENZANAS SENGAN TIČEN|VOZAČKA DOZVOLA VOZAČKA DOZVE|AWA JP267 BRENDYJAZDY PRAY/gim,
      "",
    );

    // 2b. Limpeza: Remover o que não é alfabético, espaços múltiplos
    campo2Apelido = apelidoBruto
      .trim()
      .replace(/[^a-zA-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // 3. Combinar os campos: Apelido + Nome Próprio
  if (campo1Nome && campo2Apelido) {
    // @ts-ignore
    dados.nome = `${campo2Apelido} ${campo1Nome}`;
  } else if (campo1Nome) {
    // @ts-ignore
    dados.nome = campo1Nome;
  } else if (campo2Apelido) {
    // @ts-ignore
    dados.nome = campo2Apelido;
  }

  // 2. Extração da Data de Nascimento: Procura uma data perto do campo 3.
  const dataNascimentoMatch = text.match(/3\.\s*(\d{2}\.\d{2}\.\d{4})/);
  if (dataNascimentoMatch) {
    // @ts-ignore
    dados.dataNascimento = dataNascimentoMatch[1];
  }

  // 3. Extração da Data de Emissão e Validade
  const dataEmissaoMatch = text.match(/4a\.\s*(\d{2}\.\d{2}\.\d{4})/);
  if (dataEmissaoMatch) {
    // @ts-ignore
    dados.dataEmissao = dataEmissaoMatch[1];
  }

  const dataValidadeMatch = text.match(/4b\.\s*(-|\d{2}\.\d{2}\.\d{4})/);
  if (dataValidadeMatch && dataValidadeMatch[1] !== "-") {
    // @ts-ignore
    dados.dataValidade = dataValidadeMatch[1];
  } else {
    // @ts-ignore
    dados.dataValidade = "Não especificada";
  }

  // 4. Extração do Número da Carta: Procura pelo padrão 5. FA- seguido de números.
  const numeroCartaMatch = text.match(/5\.\s*FA-(\d{5,6}\s*\d)/);
  if (numeroCartaMatch) {
    // @ts-ignore
    dados.numeroCarta = `FA-${numeroCartaMatch[1].trim()}`;
  }

  // 5. Extração das Categorias de Condução (Campo 9.)
  const categoriasMatch = text.match(
    /9\.\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*CARTA DE CONDUÇÃO)/i,
  );

  if (categoriasMatch && categoriasMatch[1]) {
    const categoriasTexto = categoriasMatch[1]
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9,\s]/g, " ")
      .replace(/\s+/g, " ");

    const categoriasArray = categoriasTexto
      .split(/[\s,]+/)
      .filter((cat: string) => cat.length > 0 && cat.match(/^[A-Z]\d?$/));

    if (categoriasArray.length > 0) {
      // @ts-ignore
      dados.categorias = [...new Set(categoriasArray)];
    }
  }
  return dados;
}

export function processarCartaConducaoVerso(text: string | null | undefined) {
  const dadosVerso = {
    tipoDocumento: "Carta de Condução (Verso)",
    categorias: [],
  };

  // @ts-ignore
  const linhas = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const regexCategorias = /(AM|A1|A2|A|B1|B|C1|C|D1|D|BE|C1E|CE|D1E|DE)/;
  const regexDatas = /(\d{2}\.\d{2}\.\d{2,4})\s*([\d.\/-]+)/;

  let categoriasEncontradas = {};

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const categoriaMatch = linha.match(regexCategorias);

    if (categoriaMatch) {
      const categoria = categoriaMatch[1];
      for (let j = i; j < Math.min(i + 5, linhas.length); j++) {
        const linhaData = linhas[j];
        const datasMatch = linhaData.match(regexDatas);

        if (datasMatch) {
          const dataInicio = datasMatch[1];
          const dataFim = datasMatch[2];

          // @ts-ignore
          const key = `${categoria}-${dataInicio}-${dataFim}`;
          // @ts-ignore
          if (!categoriasEncontradas[key]) {
            // @ts-ignore
            dadosVerso.categorias.push({
              categoria: categoria,
              dataInicio: dataInicio,
              dataFim: dataFim,
            });
            // @ts-ignore
            categoriasEncontradas[key] = true;
          }
          break;
        }
      }
    }
  }

  return dadosVerso;
}

export function processarCertificadoMatricula(text: string | null | undefined) {
  const dados = {
    tipoDocumento: "Certificado de Matrícula (Anverso)",
    matricula: null as string | null,
    dataPrimeiraMatricula: null as string | null,
    proprietario: {
      nome: null as string | null,
      morada: null as string | null,
    },
  };

  if (!text) {
    return dados;
  }

  // 1. MATRÍCULA
  const regexMatricula =
    /(\d{2}-[A-Z]{2}-\d{2})|([A-Z]{2}-\d{2}-[A-Z]{2})|(\d{2}-[A-Z]{2}-\d{2})/;
  const matchMatricula = text.match(regexMatricula);
  if (matchMatricula) {
    // @ts-ignore
    dados.matricula = matchMatricula[0];
  }

  // 2. DATA DE PRIMEIRA MATRÍCULA (B)
  const regexDataPrimeira = /(\d{4}-\d{2}-\d{2})/;
  const matchDataPrimeira = text.match(regexDataPrimeira);
  if (matchDataPrimeira) {
    dados.dataPrimeiraMatricula = matchDataPrimeira[1];
  }

  // 3. NOME DO PROPRIETÁRIO (C.1.1 e C.1.2)
  const regexNome = /C\.1\.2\s*([\s\S]*?)C\.1\.3/i;
  const matchNome = text.match(regexNome);

  if (matchNome) {
    let nomeLimpo = matchNome[1].trim();

    nomeLimpo = nomeLimpo.replace(/\n[X\s]+\n?/g, "").trim();
    nomeLimpo = nomeLimpo.replace(/\n/g, " ").trim();

    dados.proprietario.nome = nomeLimpo;
  }

  // 4. MORADA DO PROPRIETÁRIO (C.1.3)
  const regexMorada = /C\.1\.3\s*([^\n]+)/;
  const matchMorada = text.match(regexMorada);
  if (matchMorada) {
    dados.proprietario.morada = matchMorada[1].trim();
  }

  return dados;
}

export function processarVersoCertificadoMatricula(
  text: string | null | undefined,
) {
  const dadosVerso = {
    tipoDocumento: "Certificado de Matrícula (Verso)",
    marca: null,
    modelo: null,
    combustivel: null,
    cilindrada: null,
    potencia: null,
    emissoesCO2: null,
    lotação: null,
  };

  // @ts-ignore
  const marcaModeloMatch = text.match(
    /D\.1\s+([^\n]+)\n[\s\S]*?D\.3\s+([^\n]+)/,
  );
  if (marcaModeloMatch) {
    // @ts-ignore
    dadosVerso.marca = marcaModeloMatch[1].trim();
    // @ts-ignore
    dadosVerso.modelo = marcaModeloMatch[2].trim();
  }

  // @ts-ignore
  const combustivelMatch = text.match(/P\.3\s+([A-Z]+)/);
  if (combustivelMatch) {
    // @ts-ignore
    dadosVerso.combustivel = combustivelMatch[1].trim();
  }

  // @ts-ignore
  const cilindradaPotenciaMatch = text.match(
    /P\.1\s+(\d+)\n[\s\S]*?P\.2\s+(\d+)/,
  );
  if (cilindradaPotenciaMatch) {
    // @ts-ignore
    dadosVerso.cilindrada = cilindradaPotenciaMatch[1].trim();
    // @ts-ignore
    dadosVerso.potencia = cilindradaPotenciaMatch[2].trim();
  }

  // @ts-ignore
  const emissoesMatch = text.match(/V\.1\s+([\d.]+)/);
  if (emissoesMatch) {
    // @ts-ignore
    dadosVerso.emissoesCO2 = emissoesMatch[1].trim();
  }

  // @ts-ignore
  const lotacaoMatch = text.match(/S\.1\s+(\d+)/);
  if (lotacaoMatch) {
    // @ts-ignore
    dadosVerso.lotação = lotacaoMatch[1].trim();
  }

  return dadosVerso;
}
