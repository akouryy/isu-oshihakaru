import React, { useState } from 'react'
import { Sankey, SankeyPoint } from 'react-vis'
import { BasePage } from '../components/BasePage'
import { NoChild } from '../lib/reactutil/NoChild'

interface Endpoint {
  name: string
  method: string
  regexp: RegExp
}

function parseEndpoints(endpointsStr: string): [Endpoint[], string[]] {
  const errors = Array<string>()
  const endpoints = endpointsStr.trimEnd().split('\n').flatMap((l, i) => {
    const arr = l.split(' ')
    if(arr.length !== 2) {
      errors.push(`Line ${i + 1}: number of column is not 2: "${l}"`)
      return []
    }
    const [method, regexp] = arr
    return [{
      name: l,
      method,
      regexp: RegExp(`^${regexp.replaceAll(/:\w+/g, '\\w+')}(.json)?$`),
    }]
  })
  return [endpoints, errors]
}

function parseLog(ltsv: string, endpoints: Endpoint[]): [
  SankeyPoint[],
  Array<{ source: number, target: number, value: number }>,
  string[],
] {
  const nodes = new Array<SankeyPoint>()
  const links = new Map<readonly [number, number], number>()
  const errors = new Array<string>()
  const nodeToIndex = new Map<string, number>()
  const accesses = new Map<string, number[]>()

  ltsv.trimEnd().split('\n').forEach((l, i) => {
    const assocArr = l.split('\t').map((f) => {
      const sep = f.split(':', 2)
      if(sep.length === 2) { return sep }
      return null
    })
    if(assocArr.includes(null)) {
      errors.push(`Line ${i + 1}: some field does not have a colon: "${l}"`)
      return
    }
    const map = new Map(assocArr as Array<[string, string]>)
    const method = map.get('method')
    const uri = map.get('uri')
    const uid = map.get('uid')
    if(method === undefined || uri === undefined || uid === undefined) {
      errors.push(`Line ${i + 1}: either method, uri, or uid does not exist: "${l}"`)
      return
    }
    const endpoint = endpoints.find((e) => e.method === method && e.regexp.exec(uri))
    if(endpoint === undefined) {
      errors.push(`Line ${i + 1}: uri does not have matching endpoint: "${l}"`)
      return
    }
    let access = accesses.get(uid)
    if(access === undefined) {
      access = []
      accesses.set(uid, access)
    }
    const name = `#${access.length} ${endpoint.name}`
    let nodeIndex = nodeToIndex.get(name)
    if(nodeIndex === undefined) {
      nodeIndex = nodes.length
      nodeToIndex.set(name, nodeIndex)
      nodes.push({ name })
    }
    access.push(nodeIndex)
    if(access.length >= 2) {
      const link = [access[access.length - 2], access[access.length - 1]] as const
      let linkValue = links.get(link)
      if(linkValue === undefined) {
        linkValue = 0
      }
      links.set(link, linkValue + 1)
    }
  })

  return [
    nodes,
    [...links.entries()].map(([[source, target], value]) => ({ source, target, value })),
    errors,
  ]
}

const PageIndex: React.FC<NoChild> = () => {
  const [ltsv, setLTSV] = useState('')
  const [endpointsStr, setEndpointsStr] = useState('')
  const [endpoints, endpointErrors] = parseEndpoints(endpointsStr)
  const [nodes, links, ltsvErrors] = parseLog(ltsv, endpoints)

  return (
    <BasePage>
      <label>
        <div>
          ltsv.log
        </div>
        <textarea
          cols={30}
          onInput={(ev) => setLTSV(ev.currentTarget.value)}
          rows={10}
          value={ltsv}
        />
        <section style={{ color: 'red' }}>
          {ltsvErrors.slice(0, 10).join('. ')}
        </section>
      </label>
      <label>
        <div>
          Endpoints
        </div>
        <textarea
          cols={30}
          onInput={(ev) => setEndpointsStr(ev.currentTarget.value)}
          rows={10}
          placeholder='GET /chairs/:id/detail'
          value={endpointsStr}
        />
        <section style={{ color: 'red' }}>
          {endpointErrors.slice(0, 10).join('. ')}
        </section>
      </label>
      <section>
        <Sankey
          animation
          margin={50}
          nodes={nodes}
          links={links}
          width={960}
          align='left'
          height={500}
          layout={24}
          nodeWidth={15}
          nodePadding={10}
          style={{
            links: {
              opacity: 0.3,
            },
            labels: {
              fontSize: '0.8em',
            },
            rects: {
              strokeWidth: 2,
              stroke: '#1A3177',
            },
          }}
        />
      </section>
    </BasePage>
  )
}

export default PageIndex
