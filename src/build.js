/* global process */

import { Converter } from 'showdown'
import { sync as globSync } from 'glob'
import { readFileSync, writeFileSync } from 'fs'
import { template } from 'lodash'
import path from 'path'
import moment from 'moment'

const markdownConverter = new Converter({
  simplifiedAutoLink: true,
  strikethrough: true,
  tables: true
})

/**
 * Recursively build the template, this allows for includes to contain includes …
 */
const buildTemplate = (templateString, data, step) => {
  step = step || 1
  if (step >= 10) {
    console.error('Reached maximum nesting level', step)
    return templateString
  }
  const previousResult = templateString
  const result = template(templateString)(data)
  if (result === previousResult) {
    return result
  }
  return buildTemplate(result, data, ++step)
}

const isPage = entry => entry.sys.contentType.sys.id === 'page'
const isPost = entry => entry.sys.contentType.sys.id === 'post'
const isAuthor = entry => entry.sys.contentType.sys.id === 'author'

const buildPostContent = (post, locale) => {
  const content = {}
  Object.keys(post.fields).forEach(k => {
    switch (k) {
      case 'content':
      case 'abstract':
        content[k] = markdownConverter.makeHtml(post.fields[k][locale])
        break
      case 'hero':
        content[k] = {
          title: post.fields[k][locale].fields.title[locale],
          file: post.fields[k][locale].fields.file[locale]
        }
        break
      case 'author':
        content[k] = {
          name: post.fields[k][locale].fields.name[locale],
          slug: post.fields[k][locale].fields.slug[locale]
        }
        break
      default:
        content[k] = post.fields[k][locale]
    }
  })
  return content
}

const buildAuthorContent = (author, locale) => {
  const content = {}
  Object.keys(author.fields).forEach(k => {
    switch (k) {
      case 'description':
        content[k] = markdownConverter.makeHtml(author.fields[k][locale])
        break
      case 'photo':
        content[k] = {
          title: author.fields[k][locale].fields.title[locale],
          file: author.fields[k][locale].fields.file[locale]
        }
        break
      default:
        content[k] = author.fields[k][locale]
    }
  })
  return content
}

const buildPageContent = (page, locale) => {
  const content = {}
  Object.keys(page.fields).forEach(k => {
    switch (k) {
      case 'content':
        content[k] = markdownConverter.makeHtml(page.fields[k][locale])
        break
      default:
        content[k] = page.fields[k][locale]
    }
  })
  return content
}

const shortDate = date => moment(date).format('DD.MM.YYYY')
const striptags = str => str.replace(/<[^>]+>/g, '')

// This renders a page
const buildPage = (build, config, collections, blocks, content, identifier, template, includesFiles) => {
  const includes = {}
  const page = {
    url: config.webHost + config.baseHref + identifier + '.html'
  }
  const templateData = {
    build: Object.assign({identifier}, build),
    config,
    content,
    collections,
    blocks,
    includes,
    shortDate,
    striptags,
    page
  }

  // Build includes
  Object.keys(includesFiles).forEach(k => {
    includes[k] = buildTemplate(includesFiles[k], templateData)
  })

  // Build page
  const pageTemplate = buildTemplate(readFileSync(template, 'utf8'), templateData)

  // Build pages
  writeFileSync(`build/${identifier}.html`, pageTemplate)

  // Done
  console.log(`build/${identifier}.html`)

  return templateData
}

export const buildSite = (contentFile, templateDir, version, locale, environment = 'production') => {
  const content = JSON.parse(readFileSync(contentFile, 'utf-8'))

  // Find includes
  const includesDir = path.join(templateDir, '/includes/')
  const includesFiles = {}
  globSync(`${includesDir}*.html`).map(f => {
    includesFiles[f.replace(includesDir, '').replace(/\.html$/, '')] = readFileSync(f, 'utf8')
  })

  const build = {
    environment,
    version,
    time: Date.now(),
    locale
  }

  // Build the config
  const config = {}
  content.entries.filter(e => e.sys.contentType.sys.id === 'config').map(c => {
    const key = c.fields.key[build.locale]
    config[key] = process.env[`CONFIG_${key.toUpperCase()}`] || c.fields.value[build.locale]
  })

  // Build collections
  const collections = {}
  content.entries.filter(e => e.sys.contentType.sys.id === 'collection').map(c => {
    collections[c.fields.title[build.locale]] = c.fields.items[build.locale].map(e => {
      if (isPage(e)) return buildPageContent(e, build.locale)
      if (isPost(e)) return buildPostContent(e, build.locale)
    })
  })

  // Build blocks
  const blocks = {}
  content.entries.filter(e => e.sys.contentType.sys.id === 'block').map(b => {
    blocks[b.fields.identifier[build.locale]] = markdownConverter.makeHtml(b.fields.content[build.locale])
  })

  // Posts
  const posts = content.entries.filter(e => isPost(e))
    .map(post => {
      const content = buildPostContent(post, build.locale)
      return buildPage(build, config, collections, blocks, content, content.slug, path.join(templateDir, '/post.html'), includesFiles)
    })

  // Authors
  content.entries.filter(e => isAuthor(e))
    .map(page => {
      const content = buildAuthorContent(page, build.locale)
      buildPage(build, config, collections, blocks, content, content.slug, path.join(templateDir, '/author.html'), includesFiles)
    })

  // Pages
  content.entries.filter(e => isPage(e))
    .map(page => {
      const content = buildPageContent(page, build.locale)
      buildPage(build, config, collections, blocks, content, content.slug, path.join(templateDir, '/page.html'), includesFiles)
    })

  // Index
  buildPage(build, config, collections, blocks, {posts}, 'index', path.join(templateDir, '/index.html'), includesFiles)
}

