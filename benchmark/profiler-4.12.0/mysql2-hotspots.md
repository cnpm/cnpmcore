====================================================================================================
Performance Hotspots (filtered by: mysql2)
====================================================================================================

Total Active CPU Time: 42437 samples


--- Hotspot #1 ---
Function: get
Self Time: 381 samples (0.90%)
Location: mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263
Call Stack (bottom-up):
  1. keyFromFields [mysql2@3.15.3@mysql2:9]
  2. getParser [mysql2@3.15.3@mysql2:42]
  3. getTextParser [mysql2@3.15.3@mysql2:210]
  4. readField [mysql2@3.15.3@mysql2:191]
  5. execute [mysql2@3.15.3@mysql2:23]

--- Hotspot #2 ---
Function: start
Self Time: 334 samples (0.79%)
Location: mysql2@3.15.3@mysql2/lib/commands/query.js:48
Call Stack (bottom-up):
  1. execute [mysql2@3.15.3@mysql2:23]
  2. handlePacket [mysql2@3.15.3@mysql2:419]
  3. addCommand [mysql2@3.15.3@mysql2:492]
  4. query [mysql2@3.15.3@mysql2:560]
  5. (anonymous) [leoric@2.13.9@leoric:73]

--- Hotspot #3 ---
Function: keyFromFields
Self Time: 167 samples (0.39%)
Location: mysql2@3.15.3@mysql2/lib/parsers/parser_cache.js:9
Call Stack (bottom-up):
  1. getParser [mysql2@3.15.3@mysql2:42]
  2. getTextParser [mysql2@3.15.3@mysql2:210]
  3. readField [mysql2@3.15.3@mysql2:191]
  4. execute [mysql2@3.15.3@mysql2:23]
  5. handlePacket [mysql2@3.15.3@mysql2:419]

--- Hotspot #4 ---
Function: parseDateTime
Self Time: 114 samples (0.27%)
Location: mysql2@3.15.3@mysql2/lib/packets/packet.js:649
Call Stack (bottom-up):
  1. next [(native)]
  2. row [mysql2@3.15.3@mysql2:239]
  3. execute [mysql2@3.15.3@mysql2:23]
  4. handlePacket [mysql2@3.15.3@mysql2:419]
  5. (anonymous) [mysql2@3.15.3@mysql2:92]

--- Hotspot #5 ---
Function: get
Self Time: 100 samples (0.24%)
Location: mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263
Call Stack (bottom-up):
  1. keyFromFields [mysql2@3.15.3@mysql2:9]
  2. getParser [mysql2@3.15.3@mysql2:42]
  3. getTextParser [mysql2@3.15.3@mysql2:210]
  4. readField [mysql2@3.15.3@mysql2:191]
  5. execute [mysql2@3.15.3@mysql2:23]

--- Hotspot #6 ---
Function: readField
Self Time: 80 samples (0.19%)
Location: mysql2@3.15.3@mysql2/lib/commands/query.js:191
Call Stack (bottom-up):
  1. execute [mysql2@3.15.3@mysql2:23]
  2. handlePacket [mysql2@3.15.3@mysql2:419]
  3. (anonymous) [mysql2@3.15.3@mysql2:92]
  4. executeStart [mysql2@3.15.3@mysql2:63]
  5. (anonymous) [mysql2@3.15.3@mysql2:95]

--- Hotspot #7 ---
Function: row
Self Time: 56 samples (0.13%)
Location: mysql2@3.15.3@mysql2/lib/commands/query.js:239
Call Stack (bottom-up):
  1. execute [mysql2@3.15.3@mysql2:23]
  2. handlePacket [mysql2@3.15.3@mysql2:419]
  3. (anonymous) [mysql2@3.15.3@mysql2:92]
  4. executeStart [mysql2@3.15.3@mysql2:63]
  5. executePayload [mysql2@3.15.3@mysql2:120]

--- Hotspot #8 ---
Function: keyFromFields
Self Time: 43 samples (0.10%)
Location: mysql2@3.15.3@mysql2/lib/parsers/parser_cache.js:9
Call Stack (bottom-up):
  1. getParser [mysql2@3.15.3@mysql2:42]
  2. getTextParser [mysql2@3.15.3@mysql2:210]
  3. readField [mysql2@3.15.3@mysql2:191]
  4. execute [mysql2@3.15.3@mysql2:23]
  5. handlePacket [mysql2@3.15.3@mysql2:419]

--- Hotspot #9 ---
Function: row
Self Time: 39 samples (0.09%)
Location: mysql2@3.15.3@mysql2/lib/commands/query.js:239
Call Stack (bottom-up):
  1. execute [mysql2@3.15.3@mysql2:23]
  2. handlePacket [mysql2@3.15.3@mysql2:419]
  3. (anonymous) [mysql2@3.15.3@mysql2:92]
  4. executeStart [mysql2@3.15.3@mysql2:63]
  5. (anonymous) [mysql2@3.15.3@mysql2:95]

--- Hotspot #10 ---
Function: parseDateTime
Self Time: 39 samples (0.09%)
Location: mysql2@3.15.3@mysql2/lib/packets/packet.js:649
Call Stack (bottom-up):
  1. next [(native)]
  2. row [mysql2@3.15.3@mysql2:239]
  3. execute [mysql2@3.15.3@mysql2:23]
  4. handlePacket [mysql2@3.15.3@mysql2:419]
  5. (anonymous) [mysql2@3.15.3@mysql2:92]

--- Hotspot #11 ---
Function: execute
Self Time: 36 samples (0.08%)
Location: mysql2@3.15.3@mysql2/lib/commands/command.js:23
Call Stack (bottom-up):
  1. handlePacket [mysql2@3.15.3@mysql2:419]
  2. (anonymous) [mysql2@3.15.3@mysql2:92]
  3. executeStart [mysql2@3.15.3@mysql2:63]
  4. (anonymous) [mysql2@3.15.3@mysql2:95]
  5. emit [node:events:466]

--- Hotspot #12 ---
Function: ResultSetHeader
Self Time: 36 samples (0.08%)
Location: mysql2@3.15.3@mysql2/lib/packets/resultset_header.js:14
Call Stack (bottom-up):
  1. resultsetHeader [mysql2@3.15.3@mysql2:118]
  2. execute [mysql2@3.15.3@mysql2:23]
  3. handlePacket [mysql2@3.15.3@mysql2:419]
  4. (anonymous) [mysql2@3.15.3@mysql2:92]
  5. executeStart [mysql2@3.15.3@mysql2:63]

--- Hotspot #13 ---
Function: handlePacket
Self Time: 35 samples (0.08%)
Location: mysql2@3.15.3@mysql2/lib/base/connection.js:419
Call Stack (bottom-up):
  1. (anonymous) [mysql2@3.15.3@mysql2:92]
  2. executeStart [mysql2@3.15.3@mysql2:63]
  3. (anonymous) [mysql2@3.15.3@mysql2:95]
  4. emit [node:events:466]
  5. addChunk [node:internal/streams/readable:550]

--- Hotspot #14 ---
Function: createQuery
Self Time: 30 samples (0.07%)
Location: mysql2@3.15.3@mysql2/lib/base/connection.js:911
Call Stack (bottom-up):
  1. query [mysql2@3.15.3@mysql2:560]
  2. (anonymous) [leoric@2.13.9@leoric:73]
  3. query [leoric@2.13.9@leoric:70]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #15 ---
Function: exports.decode
Self Time: 30 samples (0.07%)
Location: mysql2@3.15.3@mysql2/lib/parsers/string.js:10
Call Stack (bottom-up):
  1. ColumnDefinition [mysql2@3.15.3@mysql2:22]
  2. readField [mysql2@3.15.3@mysql2:191]
  3. execute [mysql2@3.15.3@mysql2:23]
  4. handlePacket [mysql2@3.15.3@mysql2:419]
  5. (anonymous) [mysql2@3.15.3@mysql2:92]

--- Hotspot #16 ---
Function: exports.decode
Self Time: 29 samples (0.07%)
Location: mysql2@3.15.3@mysql2/lib/parsers/string.js:10
Call Stack (bottom-up):
  1. readLengthCodedString [mysql2@3.15.3@mysql2:382]
  2. next [(native)]
  3. row [mysql2@3.15.3@mysql2:239]
  4. execute [mysql2@3.15.3@mysql2:23]
  5. handlePacket [mysql2@3.15.3@mysql2:419]

--- Hotspot #17 ---
Function: parseDateTime
Self Time: 28 samples (0.07%)
Location: mysql2@3.15.3@mysql2/lib/packets/packet.js:649
Call Stack (bottom-up):
  1. next [(native)]
  2. row [mysql2@3.15.3@mysql2:239]
  3. execute [mysql2@3.15.3@mysql2:23]
  4. handlePacket [mysql2@3.15.3@mysql2:419]
  5. (anonymous) [mysql2@3.15.3@mysql2:92]

--- Hotspot #18 ---
Function: exports.decode
Self Time: 25 samples (0.06%)
Location: mysql2@3.15.3@mysql2/lib/parsers/string.js:10
Call Stack (bottom-up):
  1. get [mysql2@3.15.3@mysql2:263]
  2. keyFromFields [mysql2@3.15.3@mysql2:9]
  3. getParser [mysql2@3.15.3@mysql2:42]
  4. getTextParser [mysql2@3.15.3@mysql2:210]
  5. readField [mysql2@3.15.3@mysql2:191]

--- Hotspot #19 ---
Function: getConnection
Self Time: 22 samples (0.05%)
Location: mysql2@3.15.3@mysql2/lib/base/pool.js:35
Call Stack (bottom-up):
  1. (anonymous) [leoric@2.13.9@leoric:59]
  2. getConnection [leoric@2.13.9@leoric:58]
  3. query [leoric@2.13.9@leoric:70]
  4. cast [leoric@2.13.9@leoric:31]
  5. ignite [leoric@2.13.9@leoric:441]

--- Hotspot #20 ---
Function: query
Self Time: 22 samples (0.05%)
Location: mysql2@3.15.3@mysql2/lib/base/connection.js:560
Call Stack (bottom-up):
  1. (anonymous) [leoric@2.13.9@leoric:73]
  2. query [leoric@2.13.9@leoric:70]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #21 ---
Function: executeStart
Self Time: 22 samples (0.05%)
Location: mysql2@3.15.3@mysql2/lib/packet_parser.js:63
Call Stack (bottom-up):
  1. (anonymous) [mysql2@3.15.3@mysql2:95]
  2. emit [node:events:466]
  3. addChunk [node:internal/streams/readable:550]
  4. readableAddChunkPushByteMode [node:internal/streams/readable:463]
  5. Readable.push [node:internal/streams/readable:387]

--- Hotspot #22 ---
Function: release
Self Time: 20 samples (0.05%)
Location: mysql2@3.15.3@mysql2/lib/base/pool_connection.js:23
Call Stack (bottom-up):
  1. query [leoric@2.13.9@leoric:70]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #23 ---
Function: (anonymous)
Self Time: 20 samples (0.05%)
Location: mysql2@3.15.3@mysql2/lib/base/connection.js:92
Call Stack (bottom-up):
  1. executeStart [mysql2@3.15.3@mysql2:63]
  2. (anonymous) [mysql2@3.15.3@mysql2:95]
  3. emit [node:events:466]
  4. addChunk [node:internal/streams/readable:550]
  5. readableAddChunkPushByteMode [node:internal/streams/readable:463]

--- Hotspot #24 ---
Function: resultsetHeader
Self Time: 19 samples (0.04%)
Location: mysql2@3.15.3@mysql2/lib/commands/query.js:118
Call Stack (bottom-up):
  1. execute [mysql2@3.15.3@mysql2:23]
  2. handlePacket [mysql2@3.15.3@mysql2:419]
  3. (anonymous) [mysql2@3.15.3@mysql2:92]
  4. executeStart [mysql2@3.15.3@mysql2:63]
  5. (anonymous) [mysql2@3.15.3@mysql2:95]

--- Hotspot #25 ---
Function: format
Self Time: 18 samples (0.04%)
Location: mysql2@3.15.3@mysql2/lib/base/connection.js:509
Call Stack (bottom-up):
  1. query [mysql2@3.15.3@mysql2:560]
  2. (anonymous) [leoric@2.13.9@leoric:73]
  3. query [leoric@2.13.9@leoric:70]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #26 ---
Function: parseDateTime
Self Time: 18 samples (0.04%)
Location: mysql2@3.15.3@mysql2/lib/packets/packet.js:649
Call Stack (bottom-up):
  1. next [(native)]
  2. row [mysql2@3.15.3@mysql2:239]
  3. execute [mysql2@3.15.3@mysql2:23]
  4. handlePacket [mysql2@3.15.3@mysql2:419]
  5. (anonymous) [mysql2@3.15.3@mysql2:92]

--- Hotspot #27 ---
Function: handlePacket
Self Time: 14 samples (0.03%)
Location: mysql2@3.15.3@mysql2/lib/base/connection.js:419
Call Stack (bottom-up):
  1. addCommand [mysql2@3.15.3@mysql2:492]
  2. query [mysql2@3.15.3@mysql2:560]
  3. (anonymous) [leoric@2.13.9@leoric:73]
  4. query [leoric@2.13.9@leoric:70]
  5. runMicrotasks [(native)]

--- Hotspot #28 ---
Function: exports.decode
Self Time: 13 samples (0.03%)
Location: mysql2@3.15.3@mysql2/lib/parsers/string.js:10
Call Stack (bottom-up):
  1. readString [mysql2@3.15.3@mysql2:418]
  2. ResultSetHeader [mysql2@3.15.3@mysql2:14]
  3. resultsetHeader [mysql2@3.15.3@mysql2:118]
  4. execute [mysql2@3.15.3@mysql2:23]
  5. handlePacket [mysql2@3.15.3@mysql2:419]

--- Hotspot #29 ---
Function: exports.decode
Self Time: 13 samples (0.03%)
Location: mysql2@3.15.3@mysql2/lib/parsers/string.js:10
Call Stack (bottom-up):
  1. readLengthCodedString [mysql2@3.15.3@mysql2:382]
  2. parseDateTime [mysql2@3.15.3@mysql2:649]
  3. next [(native)]
  4. row [mysql2@3.15.3@mysql2:239]
  5. execute [mysql2@3.15.3@mysql2:23]

--- Hotspot #30 ---
Function: exports.encode
Self Time: 12 samples (0.03%)
Location: mysql2@3.15.3@mysql2/lib/parsers/string.js:39
Call Stack (bottom-up):
  1. toPacket [mysql2@3.15.3@mysql2:15]
  2. start [mysql2@3.15.3@mysql2:48]
  3. execute [mysql2@3.15.3@mysql2:23]
  4. handlePacket [mysql2@3.15.3@mysql2:419]
  5. addCommand [mysql2@3.15.3@mysql2:492]

====================================================================================================
