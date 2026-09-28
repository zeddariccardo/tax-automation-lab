// Reuses the fiscal lifecycle: invalidate on context/logout; discard late responses; no persistent cache.
import {createFiscalController} from './fiscal-controller.js';
export function createDeclarationController({auth,service,defer}){
 return createFiscalController({auth,service:{calculateFiscal:(id,year)=>service.readDeclaration(id,year)},defer});
}
