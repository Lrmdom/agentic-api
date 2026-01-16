export async function ensureProfileServiceBrand(
  userId: string,
  userEmail: string,
  serviceName: string,
  externalId: string,
  envData: any,
  supabase: any,
) {
  try {
    const serviceId = await ensureService(serviceName, supabase);
    const brandId = await ensureBrand(envData.brand_name, supabase);
    const appId = await ensureApp(envData.app_name, supabase);
    const profileId = await getProfileId(userId, supabase);
    if (!profileId) throw new Error(`Profile não encontrado: ${userId}`);

    const { data: existingRecord, error: checkError } = await supabase
      .from("profile_service_brand")
      .select("id")
      .eq("profile_id", profileId)
      .eq("service_id", serviceId)
      .eq("brand_id", brandId)
      .eq("app_id", appId)
      .single();

    const upsertData = {
      profile_id: profileId,
      service_id: serviceId,
      brand_id: brandId,
      service_user_id: externalId,
      app_id: appId,
      metadata: {
        service_type: serviceName,
        created_via: "registration_webhook",
        user_email: userEmail,
        created_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    };

    if (existingRecord) {
      await supabase
        .from("profile_service_brand")
        .update(upsertData)
        .eq("id", existingRecord.id);
      console.log(`✅ ProfileServiceBrand atualizado para ${serviceName}`);
    } else {
      await supabase.from("profile_service_brand").insert({
        ...upsertData,
        created_at: new Date().toISOString(),
      });
      console.log(`✅ ProfileServiceBrand criado para ${serviceName}`);
    }
  } catch (error) {
    console.error(
      `❌ Erro em ensureProfileServiceBrand para ${serviceName}:`,
      error,
    );
    throw error;
  }
}

export async function ensureService(
  serviceName: string,
  supabase: any,
): Promise<string> {
  const { data: existingService } = await supabase
    .from("services")
    .select("id")
    .eq("name", serviceName)
    .single();

  if (existingService) return existingService.id;

  const { data: newService } = await supabase
    .from("services")
    .insert({
      name: serviceName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  console.log(`✅ Serviço ${serviceName} criado com ID:`, newService.id);
  return newService.id;
}

export async function ensureApp(
  appName: string,
  supabase: any,
): Promise<string | null> {
  const { data: existingApp } = await supabase
    .from("apps")
    .select("id")
    .eq("name", appName)
    .single();

  if (existingApp) return existingApp.id;

  const { data: newApp } = await supabase
    .from("apps")
    .insert({ name: appName })
    .select("id")
    .single();

  console.log(`✅ App ${appName} criada com ID:`, newApp.id);
  return newApp.id;
}

export async function ensureBrand(
  brandName: string,
  supabase: any,
): Promise<string> {
  const { data: existingBrand } = await supabase
    .from("brands")
    .select("id")
    .eq("name", brandName)
    .single();

  if (existingBrand) return existingBrand.id;

  const { data: newBrand } = await supabase
    .from("brands")
    .insert({
      name: brandName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  console.log(`✅ Brand ${brandName} criada com ID:`, newBrand.id);
  return newBrand.id;
}

export async function getProfileId(
  userId: string,
  supabase: any,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .single();

  return profile?.id || null;
}
