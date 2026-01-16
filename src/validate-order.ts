// books.ts
import {Hono} from 'hono'

const app = new Hono()
const price = 55555
app.get('/', (c) => {

    //https://docs.commercelayer.io/core/external-resources/external-order-validation#triggering-external-validation
    return c.json({
        "success": true,
        "data": {}
    })
})
app.post('/', (c) => {
    //https://docs.commercelayer.io/core/external-resources/external-order-validation#triggering-external-validation
    return c.json({
        "errors": "",
        //"success": true,
        "data": {}
    })
})
app.get('/:id', (c) => c.json(`get ${c.req.param('id')}`))

export default app