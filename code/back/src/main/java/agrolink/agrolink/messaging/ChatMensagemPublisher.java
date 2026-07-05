package agrolink.agrolink.messaging;

import agrolink.agrolink.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class ChatMensagemPublisher {

	private static final Logger log = LoggerFactory.getLogger(ChatMensagemPublisher.class);

	private final RabbitTemplate rabbitTemplate;

	public ChatMensagemPublisher(RabbitTemplate rabbitTemplate) {
		this.rabbitTemplate = rabbitTemplate;
	}

	public void publicar(ChatMensagemEvent event) {
		try {
			rabbitTemplate.convertAndSend(
					RabbitMQConfig.CHAT_EXCHANGE,
					RabbitMQConfig.CHAT_ROUTING_KEY,
					event
			);
		} catch (AmqpException e) {
			log.warn("Mensagem salva no banco, mas não foi enviada ao RabbitMQ: {}", e.getMessage());
		}
	}
}