#!/usr/bin/env node

/* global process */

import program from 'commander'
import { sync } from './sync-content'
import { buildSite } from './build'

program
  .command('sync')
  .option('-s, --space <space>', 'Contentful space')
  .option('-t, --token <space>', 'Contentful access token')
  .action(options => sync(options.space, options.token)
    .then(response => {
      process.stdout.write(JSON.stringify(response))
    })
  )

program
  .command('build')
  .option('-c, --content <content>', 'content file')
  .option('-v, --version <version>', 'version')
  .option('-l, --locale <locale>', 'contentful locale')
  .option('-t, --templates <templates>', 'template directory')
  .option('-e, --environment [environment]', 'environment', 'production')
  .option('-m, --minify', 'minify output', false)
  .action(options => buildSite(options.content, options.templates, options.version, options.locale, options.environment, options.minify))

program.parse(process.argv)
