export interface RoomTimeMetadataInput {
  stateVersion: number;
  endsAt: Date;
  extensionCount: number;
}

export function serializeRoomTimeMetadata(input: RoomTimeMetadataInput): string {
  return JSON.stringify({
    schemaVersion: 1,
    stateVersion: input.stateVersion,
    endsAt: input.endsAt.toISOString(),
    extensionCount: input.extensionCount,
  });
}
