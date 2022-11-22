export enum HookType {
  Package = 'package',
  Scope = 'scope',
  Owner = 'owner',
}

export enum HookEventType {
  Star = 'package:star',
  Unstar = 'package:unstar',
  Publish = 'package:publish',
  Unpublish = 'package:unpublish',
  Owner = 'package:owner',
  OwnerRm = 'package:owner-rm',
  DistTag = 'package:dist-tag',
  DistTagRm = 'package:dist-tag-rm',
  Deprecated = 'package:deprecated',
  Undeprecated = 'package:undeprecated',
  Change = 'package:change',
}
