import Models from '../web/assistant-models.js';
import {RequestError} from './errors.ts';
export type Configuration={model:string;reasoning:string};
type Settings={version:number;configuration:Configuration};
export function configuration(value:unknown):Configuration{
  if(!Models.valid(value))throw new RequestError('Choose a supported model and reasoning level.');
  const {model,reasoning}=value as Configuration;return {model,reasoning};
}
export async function getSettings(db:D1Database):Promise<Settings>{
  const row=await db.prepare("SELECT version,configuration FROM app_settings WHERE id='assistant'").first<{version:number;configuration:string}>();
  return row?{version:row.version,configuration:configuration(JSON.parse(row.configuration))}:{version:0,configuration:{...Models.defaults}};
}
export async function saveSettings(db:D1Database,value:unknown):Promise<Settings>{
  const body=value as {version?:unknown;configuration?:unknown}|null;
  if(!body||!Number.isSafeInteger(body.version)||Number(body.version)<0)throw new RequestError('The settings version is invalid.');
  const choice=configuration(body.configuration),base=Number(body.version),serialized=JSON.stringify(choice);
  const result=await db.prepare("INSERT INTO app_settings (id,version,configuration) SELECT 'assistant',1,? WHERE ?=0 ON CONFLICT(id) DO NOTHING")
    .bind(serialized,base).run();
  if(result.meta.changes)return {version:1,configuration:choice};
  const update=await db.prepare("UPDATE app_settings SET configuration=?,version=version+1 WHERE id='assistant' AND version=?")
    .bind(serialized,base).run();
  if(update.meta.changes)return {version:base+1,configuration:choice};
  const current=await getSettings(db);
  // A lost save acknowledgement can be retried without changing anything again.
  if(current.configuration.model===choice.model&&current.configuration.reasoning===choice.reasoning)return current;
  throw new RequestError('Settings changed on another device. Reopen Settings, then choose and save again.',409);
}
