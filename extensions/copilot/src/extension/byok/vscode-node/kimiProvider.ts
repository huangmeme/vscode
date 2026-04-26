/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageParam } from '@anthropic-ai/sdk/resources';
import { LanguageModelChatMessage } from 'vscode';
import { ILogService } from '../../../platform/log/common/logService';
import { BYOKKnownModels } from '../common/byokProvider';
import { AbstractAnthropicCompatibleLMProvider } from './abstractAnthropicCompatibleProvider';
import { IBYOKStorageService } from './byokStorageService';

// https://platform.kimi.com/docs/guide/agent-support
const KIMI_BASE_URL = 'https://api.moonshot.cn/anthropic';

const KIMI_STATIC_MODELS: BYOKKnownModels = {
	'kimi-k2.5': {
		name: 'Kimi K2.5',
		maxInputTokens: 262_144,
		maxOutputTokens: 131_072,
		toolCalling: true,
		vision: true,
		thinking: true,
	},
	'kimi-k2.6': {
		name: 'Kimi K2.6',
		maxInputTokens: 262_144,
		maxOutputTokens: 131_072,
		toolCalling: true,
		vision: true,
		thinking: true,
	},
};

export class KimiLMProvider extends AbstractAnthropicCompatibleLMProvider {

	public static readonly providerName = 'Kimi';
	protected readonly baseURL = KIMI_BASE_URL;

	constructor(
		byokStorageService: IBYOKStorageService,
		@ILogService logService: ILogService,
	) {
		super(
			KimiLMProvider.providerName.toLowerCase(),
			KimiLMProvider.providerName,
			KIMI_STATIC_MODELS,
			byokStorageService,
			logService,
		);
	}

	/**
	 * Kimi's Anthropic-compatible API requires that when thinking is enabled, every
	 * assistant message containing tool_use blocks must also include a thinking block.
	 * VS Code's conversation history may not preserve thinking parts from previous turns,
	 * so we inject a minimal thinking block when missing.
	 */
	protected override _ensureThinkingBlocks(
		convertedMessages: MessageParam[],
		_originalMessages: LanguageModelChatMessage[],
	): void {
		for (const message of convertedMessages) {
			if (message.role !== 'assistant' || !Array.isArray(message.content)) {
				continue;
			}
			const content = message.content;
			const hasToolUse = content.some((block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use');
			const hasThinking = content.some(block => block.type === 'thinking' || block.type === 'redacted_thinking');
			if (hasToolUse && !hasThinking) {
				content.unshift({
					type: 'thinking',
					thinking: ' ',
					signature: '',
				});
			}
		}
	}
}
