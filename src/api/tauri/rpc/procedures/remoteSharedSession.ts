import { z } from "zod/v4";

import { defineProcedure } from "../invoke";
import * as schemas from "../schemas";

export const remoteSharedSession = {
  create: defineProcedure("remote_shared_session_create")
    .input(schemas.remoteSharedSession.CreateRemoteSharedSessionInput)
    .output(schemas.remoteSharedSession.RemoteSharedSessionRecordSchema)
    .build(),

  patch: defineProcedure("remote_shared_session_patch")
    .input(schemas.remoteSharedSession.PatchRemoteSharedSessionInput)
    .output(schemas.remoteSharedSession.RemoteSharedSessionRecordSchema)
    .build(),

  get: defineProcedure("remote_shared_session_get")
    .input(schemas.remoteSharedSession.RemoteSharedSessionIdInput)
    .output(
      schemas.remoteSharedSession.RemoteSharedSessionRecordSchema.nullable()
    )
    .build(),

  list: defineProcedure("remote_shared_session_list")
    .input(z.void())
    .output(schemas.remoteSharedSession.RemoteSharedSessionListSchema)
    .build(),

  delete: defineProcedure("remote_shared_session_delete")
    .input(schemas.remoteSharedSession.RemoteSharedSessionIdInput)
    .output(z.void())
    .build(),
};
