import { createClient } from 'contentful'

export const sync = (space, accessToken) => createClient({
  space,
  accessToken,
  host: 'cdn.contentful.com'
}).sync({initial: true})
