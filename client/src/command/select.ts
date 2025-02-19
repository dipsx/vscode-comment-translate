import {env, commands, ExtensionContext, Position, Selection, TextEditorSelectionChangeKind, window } from "vscode";
import { getConfig } from "../configuration";
import { outputChannel, translateManager, userLanguage } from "../extension";
import { lastHover } from "../languageFeature/hover";


export async function clipboard() {
    let text = await env.clipboard.readText();
    if(!text) {
        outputChannel.appendLine('clipboard:The clipboard is empty');
        return;
    }
    const targetLanguage = getConfig<string>('targetLanguage') || userLanguage;
    let translatedText = await translateManager.translate(text, {to:targetLanguage});
    outputChannel.appendLine('clipboard:' + translatedText);
    await window.showInformationMessage(translatedText,{detail: text, modal:false});
}

export async function selectLastHover() {
    let editor = window.activeTextEditor;
    if (editor) {
        // let hover = await client.sendRequest<Hover>('lastHover', { uri: editor.document.uri.toString() });
        let hover = lastHover(editor.document.uri.toString());
        if (!hover || !hover.range) return;
        editor.revealRange(hover.range);
        const {start,end} = hover.range;

        // 会复用对象？必须重新构建
        // editor.selections = [new Selection(start,end)]; 
        editor.selections = [new Selection(start.line,start.character,end.line,end.character)];
    }
}

export function mouseToSelect(context: ExtensionContext) {
    let lastShowHover: number;
    let showHoverTimer: NodeJS.Timeout;
    // 正常编码的时候，大段代码选中也会触发。 可增加 isCode() 判断，减少不必要提醒
    context.subscriptions.push(window.onDidChangeTextEditorSelection((e) => {
        // 只支持划词翻译
        if (e.kind !== TextEditorSelectionChangeKind.Mouse) return;
        let selections = e.selections.filter(selection => !selection.isEmpty);
        if (selections.length === 0 || selections.length>1) return;
        

        let laterTime = 300;
        if (lastShowHover) {
            let gap = (new Date()).getTime() - lastShowHover;
            laterTime = Math.max(600 - gap, 300);
        }
        clearTimeout(showHoverTimer);
        showHoverTimer = setTimeout(() => {
            let selectionText = e.textEditor.document.getText(selections[0]);
            if(selectionText.length > 1000) return;
            if(isCode(selectionText)) return;
            commands.executeCommand('editor.action.showHover');
            lastShowHover = (new Date()).getTime();
        }, laterTime);
    }));
}


function hasCode(text:string,symbols:string) {
    for(let symbol of symbols) {
        if(text.indexOf(symbol)>=0) return true;
    }
    return false;
}

function isCode(text:string) {

    let score = 0;
    if(hasCode(text, '=')){
        score += 10;
    }
    if(hasCode(text, ',')){
        score += 10;
    }
    if(hasCode(text, '{}')){
        score += 10;
    }
    if(hasCode(text, '()')){
        score += 10;
    }
    if(hasCode(text, '<>')){
        score += 10;
    }
    if(hasCode(text, ':.;')){
        score += 10;
    }
    if(hasCode(text, '"\'')) {
        score += 20;
    }
    
    if(text.length >200 && score>40) {
        return true;
    } else if(score>20) {
        return true;
    }

    return false;
}