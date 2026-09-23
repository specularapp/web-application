import { startTimerSchema, stopTimerSchema, taskTimeSchema } from "@/features/time-tracking/schemas";
import { getActiveTimeEntry, listTaskTimeEntries, startTimeEntry, stopTimeEntry } from "@/features/time-tracking/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "time-read");
  if ("response" in auth) return auth.response;
  /* Com `?tarefa=<id>` a resposta é o registro da pessoa naquela tarefa; sem, o cronômetro ativo dela. */
  const task = new URL(request.url).searchParams.get("tarefa");
  if (task) {
    const parsed = taskTimeSchema.safeParse({ taskId: task });
    if (!parsed.success) return Response.json({ error: "Tarefa inválida." }, { status: 400 });
    return Response.json(await listTaskTimeEntries(auth.session.supabase, auth.session.organizationId, auth.session.userId, parsed.data.taskId));
  }
  return Response.json(await getActiveTimeEntry(auth.session.supabase, auth.session.organizationId, auth.session.userId));
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "time-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, startTimerSchema);
  if ("response" in body) return body.response;
  return fromMutation(await startTimeEntry(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data), auth.session.organizationId, ["time"]);
}

export async function DELETE(request: Request) {
  const auth = await authorizeDomain(request, "time-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, stopTimerSchema);
  if ("response" in body) return body.response;
  return fromMutation(await stopTimeEntry(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data.id), auth.session.organizationId, ["time"]);
}
