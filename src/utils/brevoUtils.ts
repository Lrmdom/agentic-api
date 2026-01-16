import { createClient } from "@supabase/supabase-js";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    if (!supabaseUrl || !SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }
    // @ts-ignore
    supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY);
  }
  return supabase;
}

export async function ensureContactExists(data: {
  user: {
    user_metadata: any;
    email: string | number | boolean;
    firstName: any;
    lastName: any;
    phone: any;
  };
  listIds: any;
}) {
  try {
    // 1️⃣ Tenta buscar o contato existente
    const brevoCheck = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(data.user.email)}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!
        }
      }
    );

    if (brevoCheck.ok) {
      const brevoData = await brevoCheck.json();
      console.log(`✅ Contato já existe: ${data.user.email}`);
      return brevoData;
    }

    // 2️⃣ Se o status for 404 (não encontrado), cria o contato
    if (brevoCheck.status === 404) {
      console.log(`ℹ️ Contato não encontrado, criando: ${data.user.email}`);

      const { data: profile } = await getSupabaseClient()
        .from("profiles")
        .select(
          `
          id,
          auth_user_id,
          provider,
          providers
        `
        )
        .eq("email", data.user.email)
        .single();

      if (!profile) {
        console.error("Profile not found");
        throw new Error("Profile not found");
      }

      const createRes = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": process.env.BREVO_API_KEY!
        },
        body: JSON.stringify({
          email: data.user.email,
          attributes: {
            FIRSTNAME: data.user.firstName,
            LASTNAME: data.user.lastName,
            ...(data.user.phone && { SMS: data.user.phone }),
            SUPABASE_PROFILE_ID: (profile as any)?.id || '',
            SUPABASE_AUTH_USER_ID: (profile as any)?.auth_user_id || '',
            PROVIDER: (profile as any)?.provider || '',
            PROVIDERS: JSON.stringify((profile as any)?.providers || []),
            LANGUAGE: data.user.user_metadata.browserLanguage
          },
          updateEnabled: true, // Atualiza se já existir
          listIds: data.listIds || [] // opcional: IDs de listas onde o contato deve ser adicionado
        })
      });

      if (!createRes.ok) {
        const errData = await createRes.text();
        throw new Error(`Erro ao criar contato: ${errData}`);
      }

      const newContact = await createRes.json();
      console.log(`🆕 Contato criado: ${data.user.email}`);
      return newContact;
    }

    // 3️⃣ Se outro erro acontecer, lança exceção
    const errorBody = await brevoCheck.text();
    throw new Error(
      `Erro ao verificar contato: ${brevoCheck.status} - ${errorBody}`
    );
  } catch (err) {
    console.error("❌ Erro em ensureContactExists:", err);
    throw err;
  }
}

export async function ensureFolderExists(env: { brand_name: any }) {
  const folderName = env.brand_name || "teste_leo";
  const baseUrl = `https://api.brevo.com/v3/contacts/folders`;

  try {
    const res = await fetch("https://api.brevo.com/v3/contacts/folders", {
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY!
      }
    });

    if (!res.ok) throw new Error(`Erro ao buscar pastas: ${res.statusText}`);

    const responseData = await res.json();
    const folders = responseData.folders || [];
    // 2️⃣ Tenta encontrar uma pasta com o mesmo nome
    const existingFolder = folders.find(
      (f: { name: any }) => f.name === folderName.toUpperCase()
    );

    if (existingFolder) {
      console.log(
        `✅ Pasta "${folderName}" já existe (id: ${existingFolder.id}).`
      );
      return existingFolder;
    }

    // 3️⃣ Caso não exista, cria a pasta
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY!
      },
      body: JSON.stringify({ name: folderName.toUpperCase() })
    });

    if (!createRes.ok)
      throw new Error(`Erro ao criar pasta: ${createRes.statusText}`);

    const newFolder = await createRes.json();
    console.log(`🆕 Pasta criada: "${folderName}" (id: ${newFolder.id}).`);

    return newFolder;
  } catch (err) {
    console.error("❌ Erro ao garantir existência da pasta:", err);
    throw err;
  }
}

export async function ensureListExists(
  env: { app_name: any },
  folder: { id: any; name: any }
) {
  const listName = env.app_name; // podemos usar o mesmo nome da marca
  const baseUrl = `https://api.brevo.com/v3/contacts/lists`;
  const fldId = folder.id;
  try {
    // 1️⃣ Buscar listas existentes
    const res = await fetch(
      `https://api.brevo.com/v3/contacts/folders/${fldId}/lists`,
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!
        }
      }
    );
    if (!res.ok) throw new Error(`Erro ao buscar listas: ${res.statusText}`);

    const responseData = await res.json();
    const lists = responseData.lists || [];
    // 2️⃣ Verificar se já existe uma lista com o mesmo nome na mesma pasta
    const existingList = lists.find((l: { name: any }) => l.name === listName);

    if (existingList) {
      console.log(
        `✅ Lista "${listName}" já existe na pasta "${folder.name}" (id: ${existingList.id}).`
      );
      return existingList;
    }

    // 3️⃣ Criar nova lista
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY!
      },
      body: JSON.stringify({
        name: listName,
        folderId: fldId
      })
    });

    if (!createRes.ok)
      throw new Error(`Erro ao criar lista: ${createRes.statusText}`);

    const newList = await createRes.json();
    console.log(
      `🆕 Lista criada: "${listName}" na pasta "${folder.name}" (id: ${newList.id}).`
    );

    return newList;
  } catch (err) {
    console.error("❌ Erro ao garantir existência da lista:", err);
    throw err;
  }
}

// 🔧 FUNÇÃO: Verificar/criar lista e adicionar contato depois de um social login ou email login
//todo write only profile that in auth , are verified???
export async function ensureListAndAddContact(
  email: string,
  envData: any,
  folder: any,
  list: any,
  contact: any,
  rawBody: any
) {
  const fldId = folder.id;
  const listName = envData?.app_name || "Default Brand List";
  const listId = list.id || "Default List";
  const existingContact = contact;
  try {
    // 1️⃣ Buscar listas existentes
    const listsResp = await fetch(
      `https://api.brevo.com/v3/contacts/folders/${fldId}/lists`,
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!
        }
      }
    );

    const listsData = await listsResp.json();
    const existingList = listsData.lists?.find((l: any) => l.name === listName);

    if (existingContact) {
      console.log("put the contact contact");

      const brevoUpdateResponse = await fetch(
        `https://api.brevo.com/v3/contacts/${existingContact.email}`,
        {
          method: "PUT",
          // @ts-ignore
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "api-key": process.env.BREVO_API_KEY
          },
          body: JSON.stringify({
            attributes: {
              NOME: rawBody.user.user_metadata.name,
              SOBRENOME: rawBody.user.user_metadata.full_name,
              LANDLINE_NUMBER: rawBody.user.user_metadata.phone,
              WHATSAPP: rawBody.user.user_metadata.phone,
              SMS: rawBody.user.user_metadata.phone
            }
          })
          // Você pode querer adicionar listIds aqui se quiser garantir que a lista seja mantida/adicionada
          // listIds: [listId] // Opcional, se você estiver atualizando o contato e listas
        }
      );

      // --- Bloco Corrigido de Tratamento de Resposta ---
      if (brevoUpdateResponse.ok) {
        // PUTs bem-sucedidos na Brevo (204 No Content) não têm corpo JSON.
        // Se o status for OK (200 ou 204), consideramos que a atualização foi um sucesso.
        console.log(
          `✅ Contato ${existingContact.email} atualizado com sucesso.`
        );
        // Não tente ler o corpo com .json() aqui, a menos que você espere uma resposta.
        // Se a Brevo retornar 204 (No Content), .json() falharia.
      } else {
        // Se não for OK, lemos a mensagem de erro no corpo como texto para evitar a falha JSON.
        const errorText = await brevoUpdateResponse.text();
        console.error(
          `❌ Erro ao atualizar contato ${existingContact.email}: ${brevoUpdateResponse.status} - ${errorText}`
        );
        // Opcional: throw new Error(`Falha na atualização Brevo: ${errorText}`);
      }
    } // Fim do if (existingContact)
    if (existingList) {
      console.log(`✅ Lista "${listName}" já existe (ID ${listId})`);
      // 3️⃣ Adicionar contato à lista
      const addToListResp = await fetch(
        `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "api-key": process.env.BREVO_API_KEY!
          },
          body: JSON.stringify({
            emails: [email]
          })
        }
      );
      return;
    } else {
      console.log(`⚠️ Lista "${listName}" não existe, criando...`);

      const createListResp = await fetch(
        "https://api.brevo.com/v3/contacts/lists",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "api-key": process.env.BREVO_API_KEY!
          },
          body: JSON.stringify({
            folderId: fldId,
            name: listName
          })
        }
      );

      const createdList = await createListResp.json();
      const nwListId = createdList.id;
      console.log(
        `✅ Lista "${listName}" criada com ID ${nwListId} na pasta "${folder.name}`
      );
    }

    if (!listId) {
      console.error("❌ Nenhum listId obtido — abortando adição à lista.");
      return;
    }

    // 2️⃣ Obter contato e verificar se já pertence à lista
    const contactResp = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!
        }
      }
    );

    const contactData = await contactResp.json();
    const contactLists: number[] = contactData.listIds || [];

    if (contactLists.includes(listId)) {
      console.log(`ℹ️ Contato ${email} já está na lista "${listName}"`);
      return;
    }

    //todo add here the auth_user_id and profile_id e provider are on rawBody variable
    // 3️⃣ Adicionar contato à lista
    const addToListResp = await fetch(
      `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!
        },
        body: JSON.stringify({
          emails: [email]
        })
      }
    );

    if (!addToListResp.ok) {
      console.error(
        `❌ Erro ao adicionar ${email} à lista "${listName}":`,
        await addToListResp.text()
      );
    } else {
      console.log(`✅ ${email} adicionado à lista "${listName}"`);
    }
  } catch (err) {
    console.error("❌ Erro em ensureListAndAddContact:", err);
  }
}

export async function ensureSegmentAndAddContact(email: string, envData: any) {
  const listName = envData?.app_name || "Default App Segment";
  let listId: number | null = null;

  try {
    let allLists: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const resp = await fetch(
        `https://api.brevo.com/v3/contacts/lists?limit=50&offset=${offset}`,
        {
          headers: {
            accept: "application/json",
            "api-key": process.env.BREVO_API_KEY!
          }
        }
      );

      const data = await resp.json();
      allLists = allLists.concat(data.lists || []);

      if (data.lists?.length < 50) {
        hasMore = false;
      } else {
        offset += 50;
      }
    }

    const existingList = allLists?.find((l: any) => l.name === listName);

    if (existingList) {
      listId = existingList.id;
      console.log(
        `✅ "Segmento" (lista) "${listName}" já existe (ID ${listId})`
      );
    } else {
      console.log(`⚠️ "Segmento" (lista) "${listName}" não existe, criando...`);

      const createListResp = await fetch(
        "https://api.brevo.com/v3/contacts/lists",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "api-key": process.env.BREVO_API_KEY!
          },
          body: JSON.stringify({
            folderId: 1,
            name: listName
          })
        }
      );

      if (!createListResp.ok) {
        const errText = await createListResp.text();
        throw new Error(
          `Erro ao criar lista-segmento "${listName}": ${createListResp.status} - ${errText}`
        );
      }

      const createdList = await createListResp.json();
      listId = createdList.id;
      console.log(
        `✅ "Segmento" (lista) "${listName}" criado com ID ${listId}`
      );
    }

    if (!listId) {
      console.error("❌ Nenhum listId obtido — abortando adição.");
      return;
    }

    // 2️⃣ Verificar se o contato já está na lista
    const contactResp = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!
        }
      }
    );

    const contactData = await contactResp.json();
    const contactLists: number[] = contactData.listIds || [];

    if (contactLists.includes(listId)) {
      console.log(`ℹ️ Contato ${email} já está no "segmento" "${listName}"`);
      return;
    }

    // 3️⃣ Adicionar contato
    const addToListResp = await fetch(
      `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!
        },
        body: JSON.stringify({ emails: [email] })
      }
    );

    if (!addToListResp.ok) {
      const errText = await addToListResp.text();
      throw new Error(
        `Erro ao adicionar ${email} ao "segmento" "${listName}": ${errText}`
      );
    }

    console.log(`✅ ${email} adicionado ao "segmento" (lista) "${listName}"`);
  } catch (err) {
    console.error("❌ Erro em ensureSegmentAndAddContact:", err);
  }
}
