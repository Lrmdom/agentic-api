// src/genkit-tools/supabase-tools-native.ts
import { getSupabaseAdmin } from '../utils/supabase.js';

// Ferramenta para consultar dados no Supabase
export async function supabaseQuery(input: {
  table: string;
  select?: string;
  filter?: string;
  limit?: number;
}) {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from(input.table)
      .select(input.select || '*');

    // Aplicar limite
    if (input.limit) {
      query = query.limit(input.limit);
    }

    const { data, error, count } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
      count: count || 0,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Ferramenta para inserir dados no Supabase
export async function supabaseInsert(input: {
  table: string;
  data: any;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(input.table)
      .insert(input.data)
      .select();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Ferramenta para atualizar dados no Supabase
export async function supabaseUpdate(input: {
  table: string;
  data: any;
  filter: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Para atualização, precisamos de um filtro
    // Simplificado - em produção usar filtros mais específicos
    // @ts-ignore - Supabase types are complex, using any for flexibility
    const tableRef = (supabase as any).from(input.table);
    const { data, error, count } = await tableRef
      .update(input.data)
      .eq('id', 1) // Placeholder - deve ser substituído
      .select();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
      count,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Ferramenta para executar RPC (funções personalizadas)
export async function supabaseRPC(input: {
  functionName: string;
  params?: any;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc(input.functionName, input.params || {});

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Exportar todas as ferramentas
export const supabaseTools = {
  supabaseQuery,
  supabaseInsert,
  supabaseUpdate,
  supabaseRPC,
};
