"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/utils/supabase/getServerClient";
type SetStopStateResult = { ok: true; state: "Pendiente" | "Completada" } | { error: string };

type StopWithRoute = {
  id: string;
  orderId: string;
  route: { driver_id: string } | null;
};

export async function setStopState(
  stopId: string,
  completed: boolean
): Promise<SetStopStateResult> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debés iniciar sesión para actualizar la parada." };
  }

  const { data: stop, error: stopError } = await supabase
    .from("stops")
    .select(`
      id,
      orderId:order_id,
      route:routes ( driver_id )
    `)
    .eq("id", stopId)
    .single();

  if (stopError || !stop) {
    return { error: "No se encontró la parada." };
  }

  const typedStop = stop as unknown as StopWithRoute;

  if (typedStop.route?.driver_id !== user.id) {
    return { error: "No tenés permisos para actualizar esta parada." };
  }

  const newStopState = completed ? "Completada" : "Pendiente";

  const { error: updateStopError } = await supabase
    .from("stops")
    .update({ state: newStopState })
    .eq("id", stopId);

  if (updateStopError) {
    return { error: "No se pudo actualizar la parada: " + updateStopError.message };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("state")
    .eq("id", stop.orderId)
    .single();

  if (order && order.state !== "Cancelada") {
    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({ state: newStopState })
      .eq("id", stop.orderId);

    if (updateOrderError) {
      return {
        error:
          "La parada se actualizó pero no se pudo sincronizar el pedido: " +
          updateOrderError.message,
      };
    }
  }

  revalidatePath("/driver");

  return { ok: true, state: newStopState };
}