package agrolink.agrolink.messaging;

import agrolink.agrolink.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class ChatMensagemConsumer {

	private static final Logger log = LoggerFactory.getLogger(ChatMensagemConsumer.class);

	@RabbitListener(queues = RabbitMQConfig.CHAT_QUEUE)
	public void receber(ChatMensagemEvent event) {
		log.info(
				"RabbitMQ recebeu mensagem do chat. salaId={}, autor={}, texto={}",
				event.salaId(),
				event.autorEmail(),
				event.texto()
		);
	}
}