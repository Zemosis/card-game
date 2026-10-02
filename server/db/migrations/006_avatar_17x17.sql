-- PAINTED AVATARS GROW FROM 16×16 TO 17×17 (src/utils/avatarConstants.js).
--
-- An odd grid has a true centre column, so a drawing can be mirrored exactly.
-- serializeAvatar() now emits { v: 3, pixels: [...] } with 289 entries. Every
-- saved 16×16 (v2) avatar is copied into the new grid as it was, with a blank
-- column on the right and a blank row at the bottom.

alter table profiles drop constraint if exists profiles_custom_avatar_shape;

update profiles
set custom_avatar = jsonb_build_object(
  'v', 3,
  'pixels', (
    select jsonb_agg(
      case when r < 16 and c < 16 then custom_avatar -> 'pixels' -> (r * 16 + c) else 'null'::jsonb end
      order by r, c
    )
    from generate_series(0, 16) as r, generate_series(0, 16) as c
  )
)
where custom_avatar ->> 'v' = '2';

alter table profiles add constraint profiles_custom_avatar_shape
  check (
    custom_avatar is null
    or (
      custom_avatar ->> 'v' = '3'
      and jsonb_typeof(custom_avatar -> 'pixels') = 'array'
      and jsonb_array_length(custom_avatar -> 'pixels') = 289
    )
  );
